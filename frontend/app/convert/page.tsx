"use client";

import { useState } from "react";
import { useFileConverter } from "@/hooks/converter/useFileConverter";
import { FileList } from "@/components/converter/FileList";
import { ConversionProgress } from "@/components/converter/ConversionProgress";
import { LogViewer } from "@/components/converter/LogViewer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { PlayCircle, RefreshCw } from "lucide-react";

export default function ConvertPage() {
	const [userId, setUserId] = useState("u_123"); // Default user ID for testing
	const {
		files,
		selectedFiles,
		conversionStatuses,
		logs,
		isLoading,
		isConverting,
		toggleFileSelection,
		selectAllFiles,
		deselectAllFiles,
		loadFiles,
		startConversion,
		clearLogs,
	} = useFileConverter();

	const handleLoadFiles = () => {
		if (userId.trim()) {
			loadFiles(userId.trim());
		}
	};

	return (
		<div className='container mx-auto py-8 px-4 max-w-7xl'>
			<div className='space-y-6'>
				{/* Header */}
				<div>
					<h1 className='text-3xl font-bold mb-2'>PDF to HTML Converter</h1>
					<p className='text-muted-foreground'>
						Select PDF files from MinIO storage and convert them to HTML format
					</p>
				</div>

				{/* User ID Input & Load Files */}
				<Card className='p-6'>
					<div className='space-y-4'>
						<div>
							<label
								htmlFor='userId'
								className='text-sm font-medium mb-2 block'>
								User ID
							</label>
							<div className='flex gap-2'>
								<Input
									id='userId'
									type='text'
									placeholder='Enter user ID (e.g., u_123)'
									value={userId}
									onChange={(e) => setUserId(e.target.value)}
									disabled={isLoading || isConverting}
									className='flex-1'
								/>
								<Button
									onClick={handleLoadFiles}
									disabled={isLoading || isConverting || !userId.trim()}>
									{isLoading ? (
										<>
											<RefreshCw className='mr-2 h-4 w-4 animate-spin' />
											Loading...
										</>
									) : (
										<>
											<RefreshCw className='mr-2 h-4 w-4' />
											Load Files
										</>
									)}
								</Button>
							</div>
						</div>

						{files.length > 0 && (
							<div className='flex items-center justify-between pt-2 border-t'>
								<div className='text-sm text-muted-foreground'>
									{selectedFiles.size > 0 ? (
										<>
											<strong>{selectedFiles.size}</strong> file
											{selectedFiles.size !== 1 ? "s" : ""} selected
										</>
									) : (
										"No files selected"
									)}
								</div>
								<Button
									onClick={startConversion}
									disabled={isConverting || selectedFiles.size === 0}
									size='lg'
									className='font-semibold'>
									{isConverting ? (
										<>
											<RefreshCw className='mr-2 h-5 w-5 animate-spin' />
											Converting...
										</>
									) : (
										<>
											<PlayCircle className='mr-2 h-5 w-5' />
											Start Conversion
										</>
									)}
								</Button>
							</div>
						)}
					</div>
				</Card>

				{/* Two Column Layout */}
				<div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
					{/* Left Column: File List */}
					<div className='space-y-6'>
						<FileList
							files={files}
							selectedFiles={selectedFiles}
							onToggleSelection={toggleFileSelection}
							onSelectAll={selectAllFiles}
							onDeselectAll={deselectAllFiles}
							isLoading={isLoading}
							disabled={isConverting}
						/>
					</div>

					{/* Right Column: Progress & Logs */}
					<div className='space-y-6'>
						<ConversionProgress statuses={conversionStatuses} />
						<LogViewer logs={logs} onClear={clearLogs} />
					</div>
				</div>
			</div>
		</div>
	);
}
