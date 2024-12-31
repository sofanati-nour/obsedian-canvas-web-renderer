# Canvas Viewer

A web-based viewer for Obsidian Canvas files that allows you to view and interact with your canvas files directly in the browser.

## Features

- View Obsidian Canvas files (`.canvas`) in a web browser
- Interactive pan and zoom functionality
- Support for different node types:
  - Text nodes
  - File nodes (including Markdown files)
  - Link nodes (embedded web content)
  - Group nodes with custom colors
- Edge connections between nodes with labels
- Minimap for easy navigation
- Responsive design that adapts to your screen size

## Usage

1. Place your `.canvas` file in the `data` directory (default file should be named `default.canvas`)
2. Open `index.html` in a web browser
3. Navigate the canvas using:
   - Click and drag to pan
   - Ctrl/Cmd + scroll to zoom
   - Shift + scroll for horizontal scrolling
   - Use the control panel to:
     - Zoom in/out
     - Reset view
     - Toggle minimap

## Canvas File Structure

The viewer expects Obsidian Canvas files in JSON format with the following structure:

```json
{
  "nodes": [
    {
      "id": "unique-id",
      "type": "text|file|link|group",
      "x": 0,
      "y": 0,
      "width": 400,
      "height": 400,
      "text": "Content for text nodes",
      "file": "filename for file nodes",
      "url": "URL for link nodes",
      "color": "color-id for groups"
    }
  ],
  "edges": [
    {
      "id": "edge-id",
      "fromNode": "source-node-id",
      "toNode": "target-node-id",
      "fromSide": "top|bottom|left|right",
      "toSide": "top|bottom|left|right",
      "label": "Optional edge label"
    }
  ]
}
```

## Development

The project is built with vanilla JavaScript and HTML5 Canvas. Key files:

- `index.html`: Main entry point and layout
- `app.js`: Core application logic
- `colors.config.js`: Color configuration for nodes and groups

## License

MIT License 