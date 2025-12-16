/**
 * Extracts the body content from a full HTML document.
 * This removes <html>, <head>, <body> tags and metadata,
 * returning only the actual content that should be displayed.
 */
export function extractBodyContent(html: string): string {
	if (!html || !html.trim()) {
		return "";
	}

	// Create a temporary DOM element to parse the HTML
	const parser = new DOMParser();
	const doc = parser.parseFromString(html, "text/html");

	// Get the body element
	const body = doc.body;

	if (!body) {
		// If no body found, return the original HTML
		return html;
	}

	// Return the innerHTML of the body (the actual content without <body> tags)
	return body.innerHTML.trim();
}

/**
 * Wraps editor content back into a complete HTML document for storage.
 * Adds minimal HTML structure with UTF-8 charset.
 */
export function wrapInHtmlDocument(
	content: string,
	title: string = "Document"
): string {
	return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body>
${content}
</body>
</html>`;
}
