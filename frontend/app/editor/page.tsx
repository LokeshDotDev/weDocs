"use client";

import { useState } from "react";
import { FileSelector } from "@/components/editor/FileSelector";
import OnlyOfficeEditor from "@/components/editor/OnlyOfficeEditor";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { X } from "lucide-react";

export default function EditorPage() {
	const [selectedFile, setSelectedFile] = useState<string | null>(null);
	const [fileName, setFileName] = useState<string>("");

	const handleFileSelect = (fileId: string, name: string) => {
		setSelectedFile(fileId);
		setFileName(name);
	};

	// ONLYOFFICE edits are handled internally; no local content change handler

	// No manual save; ONLYOFFICE posts changes to backend callback

	const handleClose = () => {
		setSelectedFile(null);
		setFileName("");
	};

	return (
		<div className='min-h-screen bg-gradient-to-b from-[#050910] via-[#0a1020] to-[#0b1224] text-slate-100'>
			<div className='mx-auto w-full max-w-7xl px-4 pb-16 pt-10 space-y-8'>
				<header className='space-y-2'>
					<p className='text-sm uppercase tracking-[0.25em] text-indigo-300/80'>
						Editor
					</p>
					<h1 className='text-4xl font-bold'>Document Editor</h1>
					<p className='text-slate-300'>
						Drill into users → uploads → formatted files, then edit with a
						polished CKEditor experience.
					</p>
				</header>

				<div className='grid grid-cols-1 gap-6 lg:grid-cols-4'>
					{/* File Selector */}
					<div className='lg:col-span-1'>
						<Card className='border border-white/10 bg-white/5 backdrop-blur p-4 sticky top-6 shadow-2xl shadow-black/50'>
							<h2 className='text-lg font-semibold mb-1'>Files</h2>
							<p className='text-xs text-slate-400 mb-4'>
								Browse users, uploads, then pick a formatted file to edit.
							</p>
							<FileSelector
								selectedFile={selectedFile}
								onFileSelect={handleFileSelect}
							/>
						</Card>
					</div>

					{/* Editor */}
					<div className='lg:col-span-3'>
						{selectedFile ? (
							<Card className='border border-white/10 bg-white/5 backdrop-blur p-0 shadow-2xl shadow-black/50 overflow-hidden'>
								<div className='flex items-center justify-between px-6 py-4 border-b border-white/10 bg-gradient-to-r from-white/5 via-white/3 to-white/5'>
									<div className='space-y-1'>
										<p className='text-xs uppercase tracking-[0.2em] text-indigo-200/80'>
											Editing
										</p>
										<h2 className='text-lg font-semibold text-white break-all'>
											{fileName}
										</h2>
									</div>
									<Button
										variant='ghost'
										size='sm'
										onClick={handleClose}
										className='text-slate-300 hover:text-white'>
										<X className='w-4 h-4' />
									</Button>
								</div>

								<div className='p-6 space-y-6'>
									<div className='editor-container'>
										<OnlyOfficeEditor
											fileKey={selectedFile}
											fileName={fileName}
										/>
									</div>
									<div className='flex flex-wrap items-center gap-3 border-t border-white/10 pt-4'>
										<span className='text-sm text-slate-300'>
											Edits auto-save via ONLYOFFICE
										</span>
									</div>
								</div>
							</Card>
						) : (
							<Card className='p-10 text-center border border-dashed border-white/15 bg-white/5 backdrop-blur shadow-2xl shadow-black/40'>
								<h3 className='text-xl font-semibold mb-2'>
									Select a file to start
								</h3>
								<p className='text-slate-300'>
									Choose a user, pick an upload, then select a formatted DOCX
									file.
								</p>
							</Card>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
