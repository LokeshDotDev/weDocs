"use client";

import React, { useState, useEffect } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Download, FileText, Loader2 } from "lucide-react";

interface DocumentPreviewProps {
	originalFileKey: string;
	humanizedFileKey: string;
	fileName: string;
}

export function DocumentPreview({
	originalFileKey,
	humanizedFileKey,
	fileName,
}: DocumentPreviewProps) {
	const [originalContent, setOriginalContent] = useState<string>("");
	const [humanizedContent, setHumanizedContent] = useState<string>("");
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";

	useEffect(() => {
		const loadDocumentPreviews = async () => {
			setLoading(true);
			setError(null);

			try {
				// Fetch both original and humanized text content
				const [originalRes, humanizedRes] = await Promise.all([
					fetch(
						`${API_BASE}/api/files/preview?fileKey=${encodeURIComponent(
							originalFileKey
						)}`
					),
					fetch(
						`${API_BASE}/api/files/preview?fileKey=${encodeURIComponent(
							humanizedFileKey
						)}`
					),
				]);

				if (!originalRes.ok || !humanizedRes.ok) {
					throw new Error("Failed to load document previews");
				}

				const originalText = await originalRes.text();
				const humanizedText = await humanizedRes.text();

				setOriginalContent(originalText);
				setHumanizedContent(humanizedText);
			} catch (err) {
				setError(
					err instanceof Error ? err.message : "Failed to load previews"
				);
				console.error("Preview error:", err);
			} finally {
				setLoading(false);
			}
		};

		loadDocumentPreviews();
	}, [originalFileKey, humanizedFileKey, API_BASE]);

	const downloadFile = (fileKey: string, filename: string) => {
		try {
			const downloadUrl = `${API_BASE}/api/files/download?fileKey=${encodeURIComponent(
				fileKey
			)}`;
			
			// Create a temporary anchor element to trigger download
			const link = document.createElement("a");
			link.href = downloadUrl;
			link.download = filename;
			link.style.display = "none";
			document.body.appendChild(link);
			link.click();
			
			// Clean up after a short delay
			setTimeout(() => {
				try {
					document.body.removeChild(link);
				} catch (e) {
					// Ignore cleanup errors
				}
			}, 100);
		} catch (error) {
			console.error("Error downloading file:", error);
			alert("Failed to download file. Please try again.");
		}
	};

	const handleRetry = () => {
		setLoading(true);
		setError(null);
		const loadDocumentPreviews = async () => {
			try {
				const [originalRes, humanizedRes] = await Promise.all([
					fetch(
						`${API_BASE}/api/files/preview?fileKey=${encodeURIComponent(
							originalFileKey
						)}`
					),
					fetch(
						`${API_BASE}/api/files/preview?fileKey=${encodeURIComponent(
							humanizedFileKey
						)}`
					),
				]);

				if (!originalRes.ok || !humanizedRes.ok) {
					throw new Error("Failed to load document previews");
				}

				const originalText = await originalRes.text();
				const humanizedText = await humanizedRes.text();

				setOriginalContent(originalText);
				setHumanizedContent(humanizedText);
			} catch (err) {
				setError(
					err instanceof Error ? err.message : "Failed to load previews"
				);
				console.error("Preview error:", err);
			} finally {
				setLoading(false);
			}
		};
		loadDocumentPreviews();
	};

	if (loading) {
		return (
			<Card className='p-8'>
				<div className='flex items-center justify-center gap-2'>
					<Loader2 className='h-5 w-5 animate-spin' />
					<span>Loading document previews...</span>
				</div>
			</Card>
		);
	}

	if (error) {
		return (
			<Card className='p-8'>
				<div className='text-red-500 text-center'>
					<p>Error: {error}</p>
					<Button onClick={handleRetry} className='mt-4'>
						Retry
					</Button>
				</div>
			</Card>
		);
	}

	return (
		<div className='space-y-4'>
			<div className='flex items-center justify-between'>
				<h3 className='text-lg font-semibold flex items-center gap-2'>
					<FileText className='h-5 w-5' />
					Document Comparison: {fileName}
				</h3>
				<div className='flex gap-2'>
					<Button
						variant='outline'
						size='sm'
						onClick={() => downloadFile(originalFileKey, fileName)}>
						<Download className='h-4 w-4 mr-1' />
						Original
					</Button>
					<Button
						variant='default'
						size='sm'
						onClick={() =>
							downloadFile(
								humanizedFileKey,
								fileName.replace(".docx", "_humanized.docx")
							)
						}>
						<Download className='h-4 w-4 mr-1' />
						Humanized
					</Button>
				</div>
			</div>

			<div className='grid grid-cols-1 lg:grid-cols-2 gap-4'>
				{/* Original Document */}
				<Card className='p-4'>
					<div className='mb-3 pb-2 border-b'>
						<h4 className='font-medium text-blue-600'>Original Document</h4>
						<p className='text-sm text-gray-500'>
							{originalContent.length} characters
						</p>
					</div>
					<div className='prose prose-sm max-w-none max-h-[600px] overflow-y-auto'>
						<pre className='whitespace-pre-wrap font-sans text-sm leading-relaxed'>
							{originalContent}
						</pre>
					</div>
				</Card>

				{/* Humanized Document */}
				<Card className='p-4'>
					<div className='mb-3 pb-2 border-b'>
						<h4 className='font-medium text-green-600'>Humanized Document</h4>
						<p className='text-sm text-gray-500'>
							{humanizedContent.length} characters
						</p>
					</div>
					<div className='prose prose-sm max-w-none max-h-[600px] overflow-y-auto'>
						<pre className='whitespace-pre-wrap font-sans text-sm leading-relaxed'>
							{humanizedContent}
						</pre>
					</div>
				</Card>
			</div>

			{/* Character Difference */}
			<Card className='p-4 bg-gray-50'>
				<div className='grid grid-cols-3 gap-4 text-center'>
					<div>
						<p className='text-sm text-gray-600'>Original Length</p>
						<p className='text-lg font-semibold'>{originalContent.length}</p>
					</div>
					<div>
						<p className='text-sm text-gray-600'>Humanized Length</p>
						<p className='text-lg font-semibold'>{humanizedContent.length}</p>
					</div>
					<div>
						<p className='text-sm text-gray-600'>Difference</p>
						<p className='text-lg font-semibold'>
							{humanizedContent.length - originalContent.length > 0 ? "+" : ""}
							{humanizedContent.length - originalContent.length}
						</p>
					</div>
				</div>
			</Card>
		</div>
	);
}
