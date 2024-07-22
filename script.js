document.getElementById('pdf-upload').addEventListener('change', handleFileUpload);
document.getElementById('split-button').addEventListener('click', splitPdf);
['top-percent', 'bottom-percent', 'left-percent', 'right-percent'].forEach(id => {
	document.getElementById(id).addEventListener('input', updateCropSquare);
});

const cropSquare = document.getElementById('crop-square');
const handles = document.querySelectorAll('.handle');
const canvasContainer = document.getElementById('canvas-container');
const canvas = document.getElementById('pdf-canvas');
let isDragging = false;
let isResizing = false;
let resizeDir = '';
let initialMouseX, initialMouseY, initialWidth, initialHeight, initialLeft, initialTop;

// Hide canvas container and crop square initially
canvasContainer.style.display = 'none';
cropSquare.style.display = 'none';

async function handleFileUpload(event) {
	const file = event.target.files[0];
	if (file && file.type === 'application/pdf') {
		const reader = new FileReader();
		reader.onload = async function(e) {
			const typedarray = new Uint8Array(e.target.result);
			const pdf = await pdfjsLib.getDocument({ data: typedarray }).promise;
			processPDF(pdf);
			displayFirstPage(pdf);
			canvasContainer.style.display = 'block';
			cropSquare.style.display = 'block';
			correctNegativeValues(); // Correct negative values after displaying the first page
		};
		reader.readAsArrayBuffer(file);
	}
}

async function processPDF(pdf) {
	const pagePromises = [];
	for (let i = 1; i <= pdf.numPages; i++) {
		pagePromises.push(pdf.getPage(i).then(page => page.getViewport({ scale: 1 })));
	}

	const viewports = await Promise.all(pagePromises);
	const sizes = viewports.map(viewport => ({ width: viewport.width, height: viewport.height }));
	displaySizes(sizes);
}

function displaySizes(sizes) {
	const outputDiv = document.getElementById('output');
	outputDiv.innerHTML = ''; // Clear previous output

	const allSameSize = sizes.every(size => size.width === sizes[0].width && size.height === sizes[0].height);

	if (allSameSize) {
		outputDiv.textContent = `All pages have the same size: ${sizes[0].width} x ${sizes[0].height} pixels.`;
	} else {
		const table = document.createElement('table');
		table.border = 1;
		const headerRow = document.createElement('tr');
		headerRow.innerHTML = '<th>Page Number</th><th>Width (px)</th><th>Height (px)</th>';
		table.appendChild(headerRow);

		sizes.forEach((size, index) => {
			const row = document.createElement('tr');
			row.innerHTML = `<td>${index + 1}</td><td>${size.width}</td><td>${size.height}</td>`;
			table.appendChild(row);
		});

		outputDiv.appendChild(table);
	}
}

async function splitPdf() {
	const pdfFile = document.getElementById('pdf-upload').files[0];
	const progressContainer = document.getElementById('progress-container');
	const progressBar = document.getElementById('progress-bar');
	const progressPercentage = document.getElementById('progress-percentage');

	const topPercent = parseFloat(document.getElementById('top-percent').value) / 100;
	const bottomPercent = parseFloat(document.getElementById('bottom-percent').value) / 100;
	const leftPercent = parseFloat(document.getElementById('left-percent').value) / 100;
	const rightPercent = parseFloat(document.getElementById('right-percent').value) / 100;

	if (!pdfFile) {
		alert('Please upload a PDF file.');
		return;
	}

	progressContainer.style.display = 'flex';
	progressBar.value = 0;
	progressPercentage.textContent = '0%';

	const arrayBuffer = await pdfFile.arrayBuffer();
	const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);
	const numPages = pdfDoc.getPageCount();

	const newPdfDoc = await PDFLib.PDFDocument.create();

	for (let i = 0; i < numPages; i++) {
		const [originalPage] = await newPdfDoc.copyPages(pdfDoc, [i]);
		const { width, height } = originalPage.getSize();

		const newWidth = width * (1 - leftPercent - rightPercent);
		const newHeight = height * (1 - topPercent - bottomPercent);
		const cropLeft = width * leftPercent;
		const cropBottom = height * bottomPercent;

		originalPage.setCropBox(cropLeft, cropBottom, newWidth, newHeight);
		newPdfDoc.addPage(originalPage);

		// Update progress
		const progress = Math.round(((i + 1) / numPages) * 100);
		progressBar.value = progress;
		progressPercentage.textContent = `${progress}%`;
	}

	const newPdfBytes = await newPdfDoc.save();
	const blob = new Blob([newPdfBytes], { type: 'application/pdf' });
	const url = URL.createObjectURL(blob);

	// Display new PDF in an iframe
	const resultDiv = document.getElementById('result');
	resultDiv.innerHTML = `<iframe src="${url}" width="100%" height="500px"></iframe>`;

	// Hide progress bar after completion
	progressContainer.style.display = 'none';
}

async function displayFirstPage(pdf) {
	const page = await pdf.getPage(1);
	const viewport = page.getViewport({ scale: 1 });
	const context = canvas.getContext('2d');
	canvas.width = viewport.width;
	canvas.height = viewport.height;

	const renderContext = {
		canvasContext: context,
		viewport: viewport
	};
	await page.render(renderContext).promise();

	// Place the crop square in the center with default -0.01% crop ratios
	const width = canvas.width;
	const height = canvas.height;

	const topPercent = -0.01;
	const bottomPercent = -0.01;
	const leftPercent = -0.01;
	const rightPercent = -0.01;

	cropSquare.style.width = `${width * (1 - leftPercent - rightPercent)}px`;
	cropSquare.style.height = `${height * (1 - topPercent - bottomPercent)}px`;
	cropSquare.style.left = `${width * leftPercent}px`;
	cropSquare.style.top = `${height * topPercent}px`;

	updateInputsFromSquare();
}

function updateCropSquare() {
	let topPercent = parseFloat(document.getElementById('top-percent').value) / 100;
	let bottomPercent = parseFloat(document.getElementById('bottom-percent').value) / 100;
	let leftPercent = parseFloat(document.getElementById('left-percent').value) / 100;
	let rightPercent = parseFloat(document.getElementById('right-percent').value) / 100;

	topPercent = Math.max(0, topPercent);
	bottomPercent = Math.max(0, bottomPercent);
	leftPercent = Math.max(0, leftPercent);
	rightPercent = Math.max(0, rightPercent);

	const width = canvas.width;
	const height = canvas.height;

	cropSquare.style.width = `${width * (1 - leftPercent - rightPercent)}px`;
	cropSquare.style.height = `${height * (1 - topPercent - bottomPercent)}px`;
	cropSquare.style.left = `${width * leftPercent}px`;
	cropSquare.style.top = `${height * topPercent}px`;

	document.getElementById('top-percent').value = (topPercent * 100).toFixed(2);
	document.getElementById('bottom-percent').value = (bottomPercent * 100).toFixed(2);
	document.getElementById('left-percent').value = (leftPercent * 100).toFixed(2);
	document.getElementById('right-percent').value = (rightPercent * 100).toFixed(2);
}

const mouseMoveHandler = (e) => {
	if (isDragging) {
		const deltaX = e.clientX - initialMouseX;
		const deltaY = e.clientY - initialMouseY;
		let newLeft = initialLeft + deltaX;
		let newTop = initialTop + deltaY;

		// Keep square within the canvas
		newLeft = Math.max(0, Math.min(newLeft, canvas.width - cropSquare.offsetWidth));
		newTop = Math.max(0, Math.min(newTop, canvas.height - cropSquare.offsetHeight));

		cropSquare.style.left = newLeft + 'px';
		cropSquare.style.top = newTop + 'px';

		updateInputsFromSquare();
	} else if (isResizing) {
		const deltaX = e.clientX - initialMouseX;
		const deltaY = e.clientY - initialMouseY;

		let newWidth = initialWidth;
		let newHeight = initialHeight;
		let newLeft = initialLeft;
		let newTop = initialTop;

		switch (resizeDir) {
			case 'top-left':
				newWidth = initialWidth - deltaX;
				newHeight = initialHeight - deltaY;
				newLeft = initialLeft + deltaX;
				newTop = initialTop + deltaY;
				break;
			case 'top-right':
				newWidth = initialWidth + deltaX;
				newHeight = initialHeight - deltaY;
				newTop = initialTop + deltaY;
				break;
			case 'bottom-left':
				newWidth = initialWidth - deltaX;
				newHeight = initialHeight + deltaY;
				newLeft = initialLeft + deltaX;
				break;
			case 'bottom-right':
				newWidth = initialWidth + deltaX;
				newHeight = initialHeight + deltaY;
				break;
			case 'middle-top':
				newHeight = initialHeight - deltaY;
				newTop = initialTop + deltaY;
				break;
			case 'middle-right':
				newWidth = initialWidth + deltaX;
				break;
			case 'middle-bottom':
				newHeight = initialHeight + deltaY;
				break;
			case 'middle-left':
				newWidth = initialWidth - deltaX;
				newLeft = initialLeft + deltaX;
				break;
		}

		// Constrain the resizing to the canvas
		if (newLeft < 0) {
			newWidth = initialWidth + initialLeft;
			newLeft = 0;
		}
		if (newTop < 0) {
			newHeight = initialHeight + initialTop;
			newTop = 0;
		}
		if (newWidth + newLeft > canvas.width) {
			newWidth = canvas.width - newLeft;
		}
		if (newHeight + newTop > canvas.height) {
			newHeight = canvas.height - newTop;
		}

		if (newWidth > 10) {
			cropSquare.style.width = newWidth + 'px';
			cropSquare.style.left = newLeft + 'px';
		}
		if (newHeight > 10) {
			cropSquare.style.height = newHeight + 'px';
			cropSquare.style.top = newTop + 'px';
		}

		updateInputsFromSquare();
	}
};

const mouseUpHandler = () => {
	isDragging = false;
	isResizing = false;
	cropSquare.style.cursor = 'default';
	document.removeEventListener('mousemove', mouseMoveHandler);
	document.removeEventListener('mouseup', mouseUpHandler);
};

cropSquare.addEventListener('mousedown', (e) => {
	initialMouseX = e.clientX;
	initialMouseY = e.clientY;
	initialLeft = cropSquare.offsetLeft;
	initialTop = cropSquare.offsetTop;
	initialWidth = cropSquare.offsetWidth;
	initialHeight = cropSquare.offsetHeight;
	isDragging = true;
	cropSquare.style.cursor = 'move';
	document.addEventListener('mousemove', mouseMoveHandler);
	document.addEventListener('mouseup', mouseUpHandler);
});

handles.forEach(handle => {
	handle.addEventListener('mousedown', (e) => {
		initialMouseX = e.clientX;
		initialMouseY = e.clientY;
		initialLeft = cropSquare.offsetLeft;
		initialTop = cropSquare.offsetTop;
		initialWidth = cropSquare.offsetWidth;
		initialHeight = cropSquare.offsetHeight;
		isResizing = true;
		resizeDir = e.target.className.split(' ')[1];
		cropSquare.style.cursor = window.getComputedStyle(e.target).cursor;
		e.stopPropagation();
		document.addEventListener('mousemove', mouseMoveHandler);
		document.addEventListener('mouseup', mouseUpHandler);
	});
});

function updateInputsFromSquare() {
	const width = canvas.width;
	const height = canvas.height;

	let leftPercent = (cropSquare.offsetLeft / width) * 100;
	let topPercent = (cropSquare.offsetTop / height) * 100;
	let rightPercent = 100 - ((cropSquare.offsetLeft + cropSquare.offsetWidth) / width) * 100;
	let bottomPercent = 100 - ((cropSquare.offsetTop + cropSquare.offsetHeight) / height) * 100;

	leftPercent = Math.max(0, leftPercent);
	topPercent = Math.max(0, topPercent);
	rightPercent = Math.max(0, rightPercent);
	bottomPercent = Math.max(0, bottomPercent);

	document.getElementById('top-percent').value = topPercent.toFixed(2);
	document.getElementById('bottom-percent').value = bottomPercent.toFixed(2);
	document.getElementById('left-percent').value = leftPercent.toFixed(2);
	document.getElementById('right-percent').value = rightPercent.toFixed(2);
}

function correctNegativeValues() {
	let topPercent = parseFloat(document.getElementById('top-percent').value);
	let bottomPercent = parseFloat(document.getElementById('bottom-percent').value);
	let leftPercent = parseFloat(document.getElementById('left-percent').value);
	let rightPercent = parseFloat(document.getElementById('right-percent').value);

	topPercent = Math.max(0, topPercent);
	bottomPercent = Math.max(0, bottomPercent);
	leftPercent = Math.max(0, leftPercent);
	rightPercent = Math.max(0, rightPercent);

	document.getElementById('top-percent').value = topPercent.toFixed(2);
	document.getElementById('bottom-percent').value = bottomPercent.toFixed(2);
	document.getElementById('left-percent').value = leftPercent.toFixed(2);
	document.getElementById('right-percent').value = rightPercent.toFixed(2);

	updateCropSquare();
}
