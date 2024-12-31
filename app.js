let canvasData = null;
const nodeMap = {};

async function initCanvas() {
    try {

        canvasData = await fetch('./data/default.canvas').then(res => res.json());


        canvasData.nodes.forEach(node => { nodeMap[node.id] = node; });


        const initialView = calculateInitialView();
        scale = initialView.scale;
        offsetX = initialView.offsetX;
        offsetY = initialView.offsetY;

        
        drawAll();
    } catch (err) {
        console.error('Failed to load canvas data:', err);
    }
}




const canvas = document.getElementById('myCanvas');
const ctx = canvas.getContext('2d');


const iframeLayer = document.getElementById('iframe-layer');


const minimap = document.getElementById('minimap');
const minimapCtx = minimap.getContext('2d');
const MINIMAP_SCALE = 0.15; 


let offsetX = canvas.width / 2;
let offsetY = canvas.height / 2;
let scale = 1.0;
let isMinimapVisible = true;


let isDragging = false;
let lastX = 0;
let lastY = 0;


const linkIframes = {}; 


const markdownDivs = {}; 
let iframeUpdateTimeout = null;




canvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    lastX = e.offsetX;
    lastY = e.offsetY;
});

canvas.addEventListener('mouseup', () => {
    isDragging = false;
});

canvas.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const dx = e.offsetX - lastX;
    const dy = e.offsetY - lastY;
    offsetX += dx;
    offsetY += dy;
    lastX = e.offsetX;
    lastY = e.offsetY;
    drawAll(); 
});

canvas.addEventListener('wheel', (e) => {
    const worldCoords = screenToWorld(e.offsetX, e.offsetY);
    
    
    for (let node of canvasData.nodes) {
        if (node.type !== 'file' || !node.file.match(/\.md$/i)) continue;
        
        if (worldCoords.x >= node.x && worldCoords.x <= node.x + node.width &&
            worldCoords.y >= node.y && worldCoords.y <= node.y + node.height) {
            
            e.preventDefault(); 
            
            
            node.mdScrollOffset = (node.mdScrollOffset || 0) + e.deltaY * 0.5;
            
            
            const maxScroll = Math.max(0, (node.totalHeight || 0) - (node.height - 40));
            node.mdScrollOffset = Math.max(0, Math.min(node.mdScrollOffset, maxScroll));
            
            drawAll();
            return; 
        }
    }

    e.preventDefault(); 

    
    if (e.ctrlKey || e.metaKey) {
        const zoomFactor = 1.03;
        if (e.deltaY < 0) {
            
            scale *= zoomFactor;
        } else {
            
            scale /= zoomFactor;
        }
        
        scale = Math.max(0.05, Math.min(20, scale));
        
        zoomSlider.value = scaleToSlider(scale);
    }
    
    else if (e.shiftKey) {
        
        const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        offsetX -= delta;
    }
    
    else {
        
        offsetY -= e.deltaY;
    }

    drawAll();
});

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    drawAll();
});


canvas.width = window.innerWidth;
canvas.height = window.innerHeight;




function drawAll() {
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#222';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    
    drawGridDots();

    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    
    for (let edge of canvasData.edges) {
        drawEdge(edge);
    }

    
    for (let node of canvasData.nodes) {
        switch (node.type) {
            case 'group': drawGroup(node); break;
            case 'text': drawTextNode(node); break;
            case 'file': drawFileNode(node); break;
            case 'link': drawLinkBox(node); break;
        }
    }

    ctx.restore();

    
    debouncedUpdateIframes();
    updateMarkdownPositions();

    
    drawMinimap();
}




function drawLabelBar(x, y, label, colors) {
    
    const baseHeight = 30;
    const baseWidth = 80;
    const baseRadius = 6;
    const baseYOffset = 8;
    const baseFontSize = 16;
    const basePadding = 6;

    
    const labelScale = Math.min(0.8, Math.max(1, 1 / scale));
    const barHeight = baseHeight * labelScale;
    const barWidth = baseWidth * labelScale;
    const radius = baseRadius * labelScale;
    const yOffset = baseYOffset * labelScale;
    const fontSize = baseFontSize * labelScale;
    const xPadding = basePadding * labelScale;

    ctx.save();
    
    ctx.translate(x, y);
    ctx.scale(1/scale, 1/scale);
    ctx.translate(0, -barHeight - yOffset);

    
    ctx.fillStyle = colors.background;
    ctx.beginPath();
    ctx.moveTo(radius, 0);
    ctx.lineTo(barWidth - radius, 0);
    ctx.quadraticCurveTo(barWidth, 0, barWidth, radius);
    ctx.lineTo(barWidth, barHeight - radius);
    ctx.quadraticCurveTo(barWidth, barHeight, barWidth - radius, barHeight);
    ctx.lineTo(radius, barHeight);
    ctx.quadraticCurveTo(0, barHeight, 0, barHeight - radius);
    ctx.lineTo(0, radius);
    ctx.quadraticCurveTo(0, 0, radius, 0);
    ctx.closePath();
    ctx.fill();

    
    ctx.fillStyle = colors.foreground;
    ctx.font = `${fontSize}px 'Inter', sans-serif`;
    ctx.fillText(label, xPadding, barHeight * 0.65);

    ctx.restore();
}

function drawGroup(node) {
    const colors = getColor(node.color);
    ctx.fillStyle = colors.background;
    ctx.globalAlpha = 0.08;
    ctx.fillRect(node.x, node.y, node.width, node.height);

    ctx.globalAlpha = 1.0;
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 2;
    ctx.strokeRect(node.x, node.y, node.width, node.height);

    
    if (node.label) {
        drawLabelBar(node.x, node.y, node.label, colors);
    }
}

function drawTextNode(node) {
    ctx.fillStyle = '#333';
    ctx.globalAlpha = 0.7;
    ctx.fillRect(node.x, node.y, node.width, node.height);

    ctx.globalAlpha = 1.0;
    ctx.strokeStyle = '#555';
    ctx.strokeRect(node.x, node.y, node.width, node.height);

    
    ctx.fillStyle = '#fff';
    ctx.font = '18px sans-serif';
    const lines = node.text.split('\n');
    let lineHeight = 22;
    for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], node.x + 5, node.y + (i + 1) * lineHeight);
    }
}

function drawFileNode(node) {
    const colors = getColor(node.color);
    ctx.fillStyle = colors.background;
    ctx.globalAlpha = 0.3;
    ctx.fillRect(node.x, node.y, node.width, node.height);

    ctx.globalAlpha = 1.0;
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 2;
    ctx.strokeRect(node.x, node.y, node.width, node.height);

    
    ctx.fillStyle = colors.foreground;
    ctx.font = '16px sans-serif';
    ctx.fillText(node.file, node.x + 5, node.y - 10);

    
    if (node.file.match(/\.(png|jpg|jpeg|gif|svg)$/i)) {
        
        if (!node.imageElement) {
            node.imageElement = new Image();
            node.imageElement.src = `./data/${node.file}`;
            node.imageElement.onload = drawAll; 
        }
        
        
        if (node.imageElement.complete) {
            const aspectRatio = node.imageElement.width / node.imageElement.height;
            let drawWidth = node.width - 16; 
            let drawHeight = drawWidth / aspectRatio;
            
            
            if (drawHeight > node.height - 40) { 
                drawHeight = node.height - 40;
                drawWidth = drawHeight * aspectRatio;
            }
            
            
            const x = node.x + (node.width - drawWidth) / 2;
            const y = node.y + 32; 
            
            ctx.drawImage(node.imageElement, x, y, drawWidth, drawHeight);
        }
    } else if (node.file.match(/\.md$/i)) {
        
        if (!node.mdContent) {
            node.mdContent = 'Loading...';
            fetch(`./data/${node.file}`)
                .then(response => response.text())
                .then(text => {
                    
                    const frontmatterMatch = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
                    if (frontmatterMatch) {
                        const frontmatter = frontmatterMatch[1].split('\n').reduce((acc, line) => {
                            const [key, value] = line.split(':').map(s => s.trim());
                            acc[key] = value;
                            return acc;
                        }, {});
                        node.mdFrontmatter = frontmatter;
                        node.mdContent = frontmatterMatch[2].trim();
                    } else {
                        node.mdContent = text;
                    }
                    updateMarkdownDiv(node);
                })
                .catch(err => {
                    console.error('Failed to load markdown:', err);
                    node.mdContent = 'Failed to load content';
                    updateMarkdownDiv(node);
                });
        }
    }

    
    const fileType = getFileType(node.file);
    ctx.fillStyle = colors.foreground;
    ctx.font = '12px sans-serif';
    ctx.fillText(fileType, node.x + node.width - 50, node.y + 24);
}


function getFileType(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const types = {
        'png': 'IMG',
        'jpg': 'IMG',
        'jpeg': 'IMG',
        'gif': 'IMG',
        'svg': 'IMG',
        'md': 'MD',
        'txt': 'TXT',
        'mp3': '♪',
        'mp4': 'VID',
        'pdf': 'PDF'
    };
    return types[ext] || ext.toUpperCase();
}


canvas.addEventListener('click', (e) => {
    const worldCoords = screenToWorld(e.offsetX, e.offsetY);
    
    
    for (let node of canvasData.nodes) {
        if (node.type !== 'file') continue;
        
        if (worldCoords.x >= node.x && worldCoords.x <= node.x + node.width &&
            worldCoords.y >= node.y && worldCoords.y <= node.y + node.height) {
            
            if (node.file.match(/\.(png|jpg|jpeg|gif|svg)$/i)) {
                
                const img = new Image();
                img.src = `./data/${node.file}`;
                img.style.position = 'fixed';
                img.style.top = '50%';
                img.style.left = '50%';
                img.style.transform = 'translate(-50%, -50%)';
                img.style.maxWidth = '90vw';
                img.style.maxHeight = '90vh';
                img.style.zIndex = '2000';
                img.style.border = '2px solid #fff';
                img.style.borderRadius = '4px';
                img.style.cursor = 'pointer';
                
                const backdrop = document.createElement('div');
                backdrop.style.position = 'fixed';
                backdrop.style.top = '0';
                backdrop.style.left = '0';
                backdrop.style.width = '100%';
                backdrop.style.height = '100%';
                backdrop.style.backgroundColor = 'rgba(0,0,0,0.8)';
                backdrop.style.zIndex = '1999';
                backdrop.style.cursor = 'pointer';
                
                const closePreview = () => {
                    document.body.removeChild(img);
                    document.body.removeChild(backdrop);
                };
                img.onclick = closePreview;
                backdrop.onclick = closePreview;
                
                document.body.appendChild(backdrop);
                document.body.appendChild(img);
            } else if (node.file.match(/\.mp3$/i)) {
                
                const audio = document.createElement('audio');
                audio.controls = true;
                audio.src = `./data/${node.file}`;
                audio.style.width = '300px';
                createPreviewModal(audio, 'audio');
            }
            
            break;
        }
    }
});


function drawLinkBox(node) {
    ctx.fillStyle = '#188038';
    ctx.globalAlpha = 0.3;
    ctx.fillRect(node.x, node.y, node.width, node.height);

    ctx.globalAlpha = 1.0;
    ctx.strokeStyle = '#188038';
    ctx.lineWidth = 2;
    ctx.strokeRect(node.x, node.y, node.width, node.height);

    ctx.fillStyle = '#fff';
    ctx.font = '16px sans-serif';
    ctx.fillText(node.url, node.x + 8, node.y + 24);
}




function updateIframePositions() {
    
    canvasData.nodes.forEach(node => {
        if (node.type !== 'link') return;

        
        if (!linkIframes[node.id]) {
            const iframe = document.createElement('iframe');
            iframe.className = 'link-iframe';
            iframe.src = node.url;
            
            iframe.style.pointerEvents = 'auto';
            iframeLayer.appendChild(iframe);

            linkIframes[node.id] = iframe;
        }

        
        const iframe = linkIframes[node.id];

        
        const screenX = offsetX + scale * node.x;
        const screenY = offsetY + scale * node.y;

        
        iframe.style.transition = 'transform 0.1s ease-out';
        iframe.style.transform = `scale(${scale})`;
        iframe.style.transformOrigin = 'top left';
        iframe.style.left = screenX + 'px';
        iframe.style.top = screenY + 'px';
        iframe.style.width = node.width + 'px';
        iframe.style.height = node.height + 'px';
    });
}


function debouncedUpdateIframes() {
    updateIframePositions();
}




function drawEdge(edge) {
    const { fromNode, toNode } = getEdgeNodes(edge);
    if (!fromNode || !toNode) return;

    const [startX, startY] = getAnchorCoord(fromNode, edge.fromSide);
    const [endX, endY] = getAnchorCoord(toNode, edge.toSide);
    const [startControlX, startControlY, endControlX, endControlY] = getControlPoints(
        startX, startY, endX, endY, 
        edge.fromSide, edge.toSide
    );

    drawCurvedPath(startX, startY, endX, endY, startControlX, startControlY, endControlX, endControlY);
    drawArrowhead(endX, endY, endControlX, endControlY);

    
    if (edge.label) {
        
        const t = 0.5; 
        const x = Math.pow(1-t,3)*startX + 3*Math.pow(1-t,2)*t*startControlX + 3*(1-t)*t*t*endControlX + Math.pow(t,3)*endX;
        const y = Math.pow(1-t,3)*startY + 3*Math.pow(1-t,2)*t*startControlY + 3*(1-t)*t*t*endControlY + Math.pow(t,3)*endY;
        
        
        ctx.font = '18px sans-serif';
        const metrics = ctx.measureText(edge.label);
        const padding = 8;
        const labelWidth = metrics.width + (padding * 2);
        const labelHeight = 20;

        
        ctx.fillStyle = '#222';
        ctx.beginPath();
        ctx.roundRect(
            x - labelWidth/2,
            y - labelHeight/2 - 2,
            labelWidth,
            labelHeight,
            4
        );
        ctx.fill();

        
        ctx.fillStyle = '#ccc';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(edge.label, x, y - 2);
        ctx.textAlign = 'left'; 
        ctx.textBaseline = 'alphabetic'; 
    }
}

function getEdgeNodes(edge) {
    return {
        fromNode: nodeMap[edge.fromNode],
        toNode: nodeMap[edge.toNode]
    };
}

function getControlPoints(startX, startY, endX, endY, fromSide, toSide) {
    const PADDING = 150; 
    let startControlX = startX;
    let startControlY = startY;
    let endControlX = endX;
    let endControlY = endY;

    
    switch (fromSide) {
        case 'top': startControlY = startY - PADDING; break;
        case 'bottom': startControlY = startY + PADDING; break;
        case 'left': startControlX = startX - PADDING; break;
        case 'right': startControlX = startX + PADDING; break;
    }
    
    switch (toSide) {
        case 'top': endControlY = endY - PADDING; break;
        case 'bottom': endControlY = endY + PADDING; break;
        case 'left': endControlX = endX - PADDING; break;
        case 'right': endControlX = endX + PADDING; break;
    }

    return [startControlX, startControlY, endControlX, endControlY];
}

function drawCurvedPath(startX, startY, endX, endY, c1x, c1y, c2x, c2y) {
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.bezierCurveTo(c1x, c1y, c2x, c2y, endX, endY);
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 2;
    ctx.stroke();
}

function getAnchorCoord(node, side) {
    const midX = node.x + node.width / 2;
    const midY = node.y + node.height / 2;
    
    switch (side) {
        case 'top': return [midX, node.y];
        case 'bottom': return [midX, node.y + node.height];
        case 'left': return [node.x, midY];
        case 'right': return [node.x + node.width, midY];
        default: return [midX, midY];
    }
}

function drawArrowhead(tipX, tipY, fromX, fromY) {
    const ARROW_LENGTH = 12;
    const ARROW_WIDTH = 7;

    
    const dx = tipX - fromX;
    const dy = tipY - fromY;
    const length = Math.sqrt(dx * dx + dy * dy);
    if (length === 0) return;

    const unitX = dx / length;
    const unitY = dy / length;

    
    const leftX = tipX - unitX * ARROW_LENGTH - unitY * ARROW_WIDTH;
    const leftY = tipY - unitY * ARROW_LENGTH + unitX * ARROW_WIDTH;
    const rightX = tipX - unitX * ARROW_LENGTH + unitY * ARROW_WIDTH;
    const rightY = tipY - unitY * ARROW_LENGTH - unitX * ARROW_WIDTH;

    
    ctx.beginPath();
    ctx.fillStyle = '#ccc';
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(leftX, leftY);
    ctx.lineTo(rightX, rightY);
    ctx.closePath();
    ctx.fill();
}




function drawMinimap() {
    if (!isMinimapVisible) return;
    
    
    minimapCtx.clearRect(0, 0, minimap.width, minimap.height);
    minimapCtx.fillStyle = '#333';
    minimapCtx.fillRect(0, 0, minimap.width, minimap.height);

    minimapCtx.save();    
    
    let bounds = calculateNodesBounds();
    if (!bounds) return;

    
    const contentWidth = bounds.maxX - bounds.minX;
    const contentHeight = bounds.maxY - bounds.minY;
    const scaleX = minimap.width / contentWidth;
    const scaleY = minimap.height / contentHeight;
    const minimapScale = Math.min(scaleX, scaleY) * 0.9; 

    
    const centerX = minimap.width / 2;
    const centerY = minimap.height / 2;
    minimapCtx.translate(centerX, centerY);
    minimapCtx.scale(minimapScale, minimapScale);
    minimapCtx.translate(-(bounds.minX + contentWidth / 2), -(bounds.minY + contentHeight / 2));

    
    for (let edge of canvasData.edges) {
        drawMinimapEdge(edge);
    }

    
    for (let node of canvasData.nodes) {
        drawMinimapNode(node);
    }

    minimapCtx.restore();

    
    drawViewportRect(bounds, minimapScale);
}

function calculateNodesBounds() {
    if (!canvasData || !canvasData.nodes.length) return null;

    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    canvasData.nodes.forEach(node => {
        minX = Math.min(minX, node.x);
        minY = Math.min(minY, node.y);
        maxX = Math.max(maxX, node.x + node.width);
        maxY = Math.max(maxY, node.y + node.height);
    });

    return { minX, minY, maxX, maxY };
}

function drawMinimapNode(node) {
    const colors = getColor(node.color);
    minimapCtx.fillStyle = node.type === 'group' ? colors.border : colors.background;
    minimapCtx.globalAlpha = 0.6;
    minimapCtx.fillRect(node.x, node.y, node.width, node.height);
    minimapCtx.globalAlpha = 1.0;
}

function drawMinimapEdge(edge) {
    const fromNode = nodeMap[edge.fromNode];
    const toNode = nodeMap[edge.toNode];
    if (!fromNode || !toNode) return;

    const [startX, startY] = getAnchorCoord(fromNode, edge.fromSide);
    const [endX, endY] = getAnchorCoord(toNode, edge.toSide);

    minimapCtx.beginPath();
    minimapCtx.moveTo(startX, startY);
    minimapCtx.lineTo(endX, endY);
    minimapCtx.strokeStyle = '#666';
    minimapCtx.lineWidth = 1;
    minimapCtx.stroke();
}

function drawViewportRect(bounds, minimapScale) {
    const contentWidth = bounds.maxX - bounds.minX;
    const contentHeight = bounds.maxY - bounds.minY;
    
    
    const viewportCenterX = -offsetX / scale + canvas.width / (2 * scale);
    const viewportCenterY = -offsetY / scale + canvas.height / (2 * scale);
    
    
    const viewWidth = canvas.width / scale;
    const viewHeight = canvas.height / scale;

    minimapCtx.save();
    minimapCtx.resetTransform();

    
    const centerX = minimap.width / 2;
    const centerY = minimap.height / 2;
    
    
    const viewRectX = centerX + (viewportCenterX - viewWidth/2 - (bounds.minX + contentWidth/2)) * minimapScale;
    const viewRectY = centerY + (viewportCenterY - viewHeight/2 - (bounds.minY + contentHeight/2)) * minimapScale;
    const viewRectWidth = viewWidth * minimapScale;
    const viewRectHeight = viewHeight * minimapScale;

    
    minimapCtx.strokeStyle = '#fff';
    minimapCtx.lineWidth = 2;
    minimapCtx.strokeRect(viewRectX, viewRectY, viewRectWidth, viewRectHeight);

    minimapCtx.restore();
}


function calculateInitialView() {
    const bounds = calculateNodesBounds();
    if (!bounds) return { scale: 1.0, offsetX: canvas.width / 2, offsetY: canvas.height / 2 };

    
    const PADDING = 50;
    const contentWidth = bounds.maxX - bounds.minX + (PADDING * 2);
    const contentHeight = bounds.maxY - bounds.minY + (PADDING * 2);

    
    const scaleX = canvas.width / contentWidth;
    const scaleY = canvas.height / contentHeight;
    const newScale = Math.min(scaleX, scaleY);

    
    const contentCenterX = bounds.minX + (bounds.maxX - bounds.minX) / 2;
    const contentCenterY = bounds.minY + (bounds.maxY - bounds.minY) / 2;

    return {
        scale: newScale,
        offsetX: canvas.width/2 - contentCenterX * newScale,
        offsetY: canvas.height/2 - contentCenterY * newScale
    };
}


function drawGridDots() {
}


function screenToWorld(screenX, screenY) {
    return {
        x: (screenX - offsetX) / scale,
        y: (screenY - offsetY) / scale
    };
}




initCanvas();




const zoomSlider = document.getElementById('zoom-slider');
const minimapCanvas = document.getElementById('minimap');
const toggleMinimapBtn = document.getElementById('toggle-minimap');


function sliderToScale(value) {
    return Math.pow(1.1, value);
}


function scaleToSlider(scale) {
    return Math.log(scale) / Math.log(1.1);
}


function updateScale(newScale) {
    scale = Math.max(0.05, Math.min(20, newScale));
    zoomSlider.value = scaleToSlider(scale);
    drawAll();
}


document.getElementById('zoom-in').addEventListener('click', () => {
    updateScale(scale * 1.2);
});

document.getElementById('zoom-out').addEventListener('click', () => {
    updateScale(scale / 1.2);
});


zoomSlider.addEventListener('input', (e) => {
    updateScale(sliderToScale(e.target.value));
});


document.getElementById('reset-view').addEventListener('click', () => {
    const initialView = calculateInitialView();
    scale = initialView.scale;
    offsetX = initialView.offsetX;
    offsetY = initialView.offsetY;
    zoomSlider.value = scaleToSlider(scale);
    drawAll();
});


toggleMinimapBtn.addEventListener('click', () => {
    isMinimapVisible = !isMinimapVisible;
    minimapCanvas.style.display = isMinimapVisible ? 'block' : 'none';
    toggleMinimapBtn.textContent = isMinimapVisible ? 'Hide Minimap' : 'Show Minimap';
});


const controlsPanel = document.getElementById('controls');
const toggleCollapseBtn = document.getElementById('toggle-collapse');

toggleCollapseBtn.addEventListener('click', () => {
    controlsPanel.classList.toggle('collapsed');
});

function createPreviewModal(content, type) {
    
    const modal = document.createElement('div');
    modal.style.position = 'fixed';
    modal.style.top = '50%';
    modal.style.left = '50%';
    modal.style.transform = 'translate(-50%, -50%)';
    modal.style.backgroundColor = '#333';
    modal.style.padding = '20px';
    modal.style.borderRadius = '8px';
    modal.style.maxWidth = '90vw';
    modal.style.maxHeight = '90vh';
    modal.style.overflow = 'auto';
    modal.style.zIndex = '2000';
    modal.style.border = '2px solid #555';
    modal.style.color = '#fff';

    
    const backdrop = document.createElement('div');
    backdrop.style.position = 'fixed';
    backdrop.style.top = '0';
    backdrop.style.left = '0';
    backdrop.style.width = '100%';
    backdrop.style.height = '100%';
    backdrop.style.backgroundColor = 'rgba(0,0,0,0.8)';
    backdrop.style.zIndex = '1999';
    backdrop.style.cursor = 'pointer';

    
    const closeButton = document.createElement('button');
    closeButton.textContent = '×';
    closeButton.style.position = 'absolute';
    closeButton.style.right = '10px';
    closeButton.style.top = '10px';
    closeButton.style.background = 'none';
    closeButton.style.border = 'none';
    closeButton.style.color = '#fff';
    closeButton.style.fontSize = '24px';
    closeButton.style.cursor = 'pointer';
    modal.appendChild(closeButton);

    
    if (type === 'audio') {
        modal.appendChild(content);
    } else if (type === 'markdown') {
        const contentDiv = document.createElement('div');
        contentDiv.style.marginTop = '20px';
        contentDiv.innerHTML = content;
        modal.appendChild(contentDiv);
    }

    
    const closeModal = () => {
        document.body.removeChild(modal);
        document.body.removeChild(backdrop);
    };
    closeButton.onclick = closeModal;
    backdrop.onclick = closeModal;

    document.body.appendChild(backdrop);
    document.body.appendChild(modal);
}


function parseMarkdown(text) {
    return text
        
        .replace(/^# (.*$)/gm, '<h1>$1</h1>')
        .replace(/^## (.*$)/gm, '<h2>$1</h2>')
        .replace(/^### (.*$)/gm, '<h3>$1</h3>')
        
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        
        .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
        
        .replace(/`(.*?)`/g, '<code>$1</code>')
        
        .replace(/^\s*\-\s(.*)/gm, '<li>$1</li>')
        .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
        
        .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank">$1</a>')
        
        .replace(/^\s*(\n)?(.+)/gm, function(m) {
            return /\<(\/)?(h\d|ul|li|pre|code|a|strong|em)/.test(m) ? m : '<p>' + m + '</p>';
        })
        
        .replace(/\n/g, '<br>');
}


canvas.addEventListener('wheel', (e) => {
    if (e.ctrlKey || e.metaKey) return; 
    
    const worldCoords = screenToWorld(e.offsetX, e.offsetY);
    
    
    for (let node of canvasData.nodes) {
        if (node.type !== 'file' || !node.file.match(/\.md$/i)) continue;
        
        if (worldCoords.x >= node.x && worldCoords.x <= node.x + node.width &&
            worldCoords.y >= node.y && worldCoords.y <= node.y + node.height) {
            
            e.preventDefault(); 
            
            
            node.mdScrollOffset = (node.mdScrollOffset || 0) + e.deltaY * 0.5;
            
            
            const maxScroll = Math.max(0, (node.totalHeight || 0) - (node.height - 40));
            node.mdScrollOffset = Math.max(0, Math.min(node.mdScrollOffset, maxScroll));
            
            drawAll();
            break;
        }
    }
});


function updateMarkdownDiv(node) {
    if (!markdownDivs[node.id]) {
        const div = document.createElement('div');
        div.className = 'markdown-content';
        document.getElementById('markdown-layer').appendChild(div);
        markdownDivs[node.id] = div;
    }

    const div = markdownDivs[node.id];
    
    
    const parsedContent = parseMarkdown(node.mdContent);
    if (div.innerHTML !== parsedContent) {
        div.innerHTML = parsedContent;
    }

    
    const screenX = offsetX + scale * node.x;
    const screenY = offsetY + scale * node.y;

    div.style.transform = `scale(${scale})`;
    div.style.transformOrigin = 'top left';
    div.style.left = screenX + 'px';
    div.style.top = screenY + 'px';
    div.style.width = node.width + 'px';
    div.style.height = node.height + 'px';

    
    const colors = getColor(node.color);
    div.style.backgroundColor = colors.background;
    div.style.borderColor = colors.border;
    div.style.color = colors.foreground;
    div.style.border = `2px solid ${colors.border}`;

    
    if (node.mdFrontmatter?.direction === 'rtl') {
        div.style.direction = 'rtl';
        div.style.textAlign = 'right';
    }
}


function updateMarkdownPositions() {
    canvasData.nodes.forEach(node => {
        if (node.type === 'file' && node.file.match(/\.md$/i) && node.mdContent) {
            updateMarkdownDiv(node);
        }
    });
}


