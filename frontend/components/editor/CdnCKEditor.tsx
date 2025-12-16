"use client";

import { useEffect, useRef } from "react";

declare global {
	interface Window {
		DecoupledEditor?: any;
	}
}

interface Props {
	data: string;
	onChange: (html: string) => void;
}

// Decoupled Document build from CDN for a Word-like editing experience
export default function CdnCKEditor({ data, onChange }: Props) {
	const editorRef = useRef<HTMLDivElement>(null);
	const instanceRef = useRef<any>(null);

	useEffect(() => {
		const loadScript = (src: string) =>
			new Promise<void>((resolve, reject) => {
				const s = document.createElement("script");
				s.src = src;
				s.async = true;
				s.onload = () => resolve();
				s.onerror = reject;
				document.body.appendChild(s);
			});

		let destroyed = false;

		async function init() {
			// Decoupled editor build includes rich, document-like UI
			await loadScript(
				"https://cdn.ckeditor.com/ckeditor5/41.2.1/decoupled-document/ckeditor.js"
			);

			if (destroyed || !editorRef.current) return;

			const DecoupledEditor = (window as any).DecoupledEditor;

			const toolbarContainer = document.createElement("div");
			toolbarContainer.style.display = "flex";
			toolbarContainer.style.flexWrap = "wrap";
			toolbarContainer.style.gap = "8px";
			toolbarContainer.style.padding = "8px";
			toolbarContainer.style.background = "white";
			toolbarContainer.style.border = "1px solid #e5e7eb";
			toolbarContainer.style.borderRadius = "8px 8px 0 0";

			const editableContainer = document.createElement("div");
			editableContainer.style.background = "white";
			editableContainer.style.color = "#111827";
			editableContainer.style.padding = "24px";
			editableContainer.style.border = "1px solid #e5e7eb";
			editableContainer.style.borderTop = "none";
			editableContainer.style.borderRadius = "0 0 8px 8px";
			editableContainer.style.minHeight = "700px";
			editableContainer.style.boxShadow = "0 1px 2px rgba(0,0,0,0.06)";

			// Constrain width like a document page for readability
			editableContainer.style.maxWidth = "840px";
			editableContainer.style.margin = "0 auto";

			editorRef.current.appendChild(toolbarContainer);
			editorRef.current.appendChild(editableContainer);

			const editor = await DecoupledEditor.create(editableContainer, {
				// Preserve arbitrary HTML to improve fidelity
				htmlSupport: {
					allow: [
						{ name: /.*/, classes: true, styles: true, attributes: true },
					],
				},
				// Better paste from Office/Word behavior (if present in build)
				// Config will be ignored gracefully if plugin is absent in CDN build
				pasteFromOffice: {
					enabled: true,
				},
				toolbar: {
					items: [
						"undo",
						"redo",
						"|",
						"heading",
						"fontSize",
						"fontColor",
						"fontBackgroundColor",
						"|",
						"bold",
						"italic",
						"underline",
						"strikethrough",
						"|",
						"link",
						"insertTable",
						"imageUpload",
						"blockQuote",
						"codeBlock",
						"|",
						"bulletedList",
						"numberedList",
						"todoList",
						"|",
						"alignment",
						"indent",
						"outdent",
					],
				},
			});

			// Place toolbar above editor
			toolbarContainer.appendChild(editor.ui.view.toolbar.element);

			// Set initial HTML
			editor.setData(data || "");
			instanceRef.current = editor;

			// Relay changes
			editor.model.document.on("change:data", () => {
				const html = editor.getData();
				onChange(html);
			});
		}

		init();

		return () => {
			destroyed = true;
			if (instanceRef.current) {
				instanceRef.current.destroy().catch(() => {});
				instanceRef.current = null;
			}
			if (editorRef.current) {
				editorRef.current.innerHTML = "";
			}
		};
	}, [data, onChange]);

	return <div ref={editorRef} />;
}
