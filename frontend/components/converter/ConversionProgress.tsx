"use client";

import { ConversionStatus } from "@/lib/converter/types/converter-types";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Loader2, Clock } from "lucide-react";

interface ConversionProgressProps {
	statuses: Map<string, ConversionStatus>;
}

export function ConversionProgress({ statuses }: ConversionProgressProps) {
	const statusArray = Array.from(statuses.values());

	if (statusArray.length === 0) {
		return null;
	}

	const getStatusIcon = (status: ConversionStatus["status"]) => {
		switch (status) {
			case "success":
				return <CheckCircle2 className='h-5 w-5 text-green-600' />;
			case "error":
				return <XCircle className='h-5 w-5 text-red-600' />;
			case "converting":
				return <Loader2 className='h-5 w-5 text-blue-600 animate-spin' />;
			case "pending":
				return <Clock className='h-5 w-5 text-gray-400' />;
		}
	};

	const getStatusBadge = (status: ConversionStatus["status"]) => {
		switch (status) {
			case "success":
				return <Badge className='bg-green-600'>Success</Badge>;
			case "error":
				return <Badge variant='destructive'>Error</Badge>;
			case "converting":
				return <Badge className='bg-blue-600'>Converting</Badge>;
			case "pending":
				return <Badge variant='secondary'>Pending</Badge>;
		}
	};

	const getElapsedTime = (startTime?: Date, endTime?: Date) => {
		if (!startTime) return "";
		const end = endTime || new Date();
		const elapsed = Math.floor((end.getTime() - startTime.getTime()) / 1000);
		if (elapsed < 60) return `${elapsed}s`;
		const minutes = Math.floor(elapsed / 60);
		const seconds = elapsed % 60;
		return `${minutes}m ${seconds}s`;
	};

	const successCount = statusArray.filter((s) => s.status === "success").length;
	const errorCount = statusArray.filter((s) => s.status === "error").length;
	const convertingCount = statusArray.filter(
		(s) => s.status === "converting"
	).length;
	const totalProgress = Math.round((successCount / statusArray.length) * 100);

	return (
		<Card className='p-6'>
			<div className='space-y-4'>
				<div className='flex items-center justify-between'>
					<h3 className='text-lg font-semibold'>Conversion Progress</h3>
					<div className='flex gap-2'>
						<Badge variant='outline' className='bg-green-50'>
							✅ {successCount}
						</Badge>
						<Badge variant='outline' className='bg-red-50'>
							❌ {errorCount}
						</Badge>
						{convertingCount > 0 && (
							<Badge variant='outline' className='bg-blue-50'>
								🔄 {convertingCount}
							</Badge>
						)}
					</div>
				</div>

				<div className='space-y-2'>
					<div className='flex items-center justify-between text-sm'>
						<span className='text-muted-foreground'>Overall Progress</span>
						<span className='font-medium'>{totalProgress}%</span>
					</div>
					<Progress value={totalProgress} className='h-2' />
					<div className='text-xs text-muted-foreground'>
						{successCount} of {statusArray.length} files converted
					</div>
				</div>

				<div className='space-y-2 max-h-80 overflow-y-auto'>
					{statusArray.map((status) => (
						<div
							key={status.fileKey}
							className='flex items-start gap-3 p-3 rounded-lg border bg-card'>
							<div className='mt-0.5'>{getStatusIcon(status.status)}</div>
							<div className='flex-1 min-w-0 space-y-1'>
								<div className='flex items-center gap-2'>
									<div className='font-medium truncate'>{status.fileName}</div>
									{getStatusBadge(status.status)}
								</div>

								{status.status === "converting" && (
									<Progress value={status.progress} className='h-1' />
								)}

								<div className='text-xs text-muted-foreground'>
									{status.startTime && (
										<span>
											Time: {getElapsedTime(status.startTime, status.endTime)}
										</span>
									)}
									{status.error && (
										<div className='text-red-600 mt-1'>
											Error: {status.error}
										</div>
									)}
									{status.result && (
										<div className='text-green-600 mt-1'>
											✓ Converted to:{" "}
											{status.result.formatted_path.split("/").pop()}
										</div>
									)}
								</div>
							</div>
						</div>
					))}
				</div>
			</div>
		</Card>
	);
}
