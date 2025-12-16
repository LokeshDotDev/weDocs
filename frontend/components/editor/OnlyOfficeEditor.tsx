"use client";

import { useEffect, useRef } from "react";
import crypto from "crypto";

declare global {
	interface Window {
		DocsAPI?: any;
	}
}

interface OnlyOfficeEditorProps {
	fileKey: string;
	fileName: string;
	onSave?: () => void;
}

export default function OnlyOfficeEditor({
	fileKey,
	fileName,
	onSave,
}: OnlyOfficeEditorProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const editorRef = useRef<any>(null);

	// Generate a simple, unique document key (hash) from the fileKey
	// ONLYOFFICE needs a key without slashes or spaces
	const getDocumentKey = (key: string): string => {
		// Use a simple hash or Base64 encoding of the fileKey
		const hash = Buffer.from(key)
			.toString("base64")
			.replace(/[^a-zA-Z0-9]/g, "")
			.substring(0, 40);
		return `doc-${hash}`;
	};

	useEffect(() => {
		const loadScript = () => {
			return new Promise<void>((resolve, reject) => {
				// Check if already loaded
				if (window.DocsAPI) {
					resolve();
					return;
				}

				const script = document.createElement("script");
				script.src = `${
					process.env.NEXT_PUBLIC_ONLYOFFICE_API_URL || "http://localhost:8080"
				}/web-apps/apps/api/documents/api.js`;
				script.async = true;
				script.onload = () => resolve();
				script.onerror = () =>
					reject(new Error("Failed to load ONLYOFFICE API"));
				document.body.appendChild(script);
			});
		};

		const initEditor = async () => {
			try {
				await loadScript();

				if (!window.DocsAPI || !containerRef.current) {
					console.error("ONLYOFFICE API not available");
					return;
				}

				// Get the document URL from backend
				console.log(`Fetching presigned URL for file: ${fileKey}`);
				const urlResponse = await fetch(
					`/api/editor/docx-url?key=${encodeURIComponent(fileKey)}`
				);
				if (!urlResponse.ok) {
					console.error(
						`Failed to get document URL: ${urlResponse.status} ${urlResponse.statusText}`
					);
					const errorText = await urlResponse.text();
					console.error("Error response:", errorText);
					throw new Error(
						`Failed to get document URL: ${urlResponse.statusText}`
					);
				}
				const { url: presignedUrl } = await urlResponse.json();
				console.log(`Got presigned URL: ${presignedUrl}`);

				// Use direct by-key streaming endpoint to avoid presigned URL complications
				// This streams the DOCX directly from MinIO via the server using the object key
				const docUrl = `http://host.docker.internal:3001/api/files/docx-by-key?key=${encodeURIComponent(
					fileKey
				)}`;
				console.log(`Using direct document URL: ${docUrl}`);

				// Configure ONLYOFFICE editor
				// Since ONLYOFFICE runs in Docker, callback must use host.docker.internal
				const callbackUrl = `http://host.docker.internal:3001/api/files/docx-save?fileKey=${encodeURIComponent(
					fileKey
				)}`;
				const documentKey = getDocumentKey(fileKey);

				console.log(
					`ONLYOFFICE config - Document Key: ${documentKey}, Callback: ${callbackUrl}`
				);

				const config = {
					documentType: "word", // word, cell, or slide
					document: {
						fileType: "docx",
						key: documentKey, // Simple, unique identifier (no slashes/spaces)
						title: fileName,
						url: docUrl, // Use proxy URL for CORS support
						permissions: {
							edit: true,
							download: true,
							print: true,
							review: true,
						},
					},
					editorConfig: {
						mode: "edit", // 'view' or 'edit'
						lang: "en",
						callbackUrl: callbackUrl, // Where ONLYOFFICE sends the edited doc
						customization: {
							autosave: true,
							forcesave: true,
							compactHeader: false,
							toolbarNoTabs: false,
						},
						user: {
							id: "user-1",
							name: "Editor User",
						},
					},
					events: {
						onDocumentReady: () => {
							console.log("✅ Document is ready");
						},
						onError: (error: any) => {
							console.error("❌ ONLYOFFICE error:", error);
							console.error(
								"Error details:",
								JSON.stringify(error.data, null, 2)
							);
						},
						onWarning: (warning: any) => {
							console.warn("⚠️ ONLYOFFICE warning:", warning);
							console.warn(
								"Warning details:",
								JSON.stringify(warning.data, null, 2)
							);
						},
						onRequestSaveAs: (event: any) => {
							console.log("💾 Save as requested:", event);
						},
					},
					width: "100%",
					height: "800px",
				};

				// Destroy existing editor if any
				if (editorRef.current) {
					editorRef.current.destroyEditor();
					editorRef.current = null;
				}

				// Initialize editor
				editorRef.current = new window.DocsAPI.DocEditor(
					containerRef.current.id,
					config
				);

				console.log("ONLYOFFICE editor initialized");
			} catch (error) {
				console.error("Failed to initialize ONLYOFFICE editor:", error);
			}
		};

		initEditor();

		return () => {
			if (editorRef.current) {
				try {
					editorRef.current.destroyEditor();
				} catch (error) {
					console.error("Error destroying editor:", error);
				}
				editorRef.current = null;
			}
		};
	}, [fileKey, fileName]);

	return (
		<div
			id='onlyoffice-editor'
			ref={containerRef}
			style={{ width: "100%", height: "800px" }}
		/>
	);
}
