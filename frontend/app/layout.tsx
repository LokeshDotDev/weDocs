import type { Metadata } from "next";
import "@/styles/globals.css";

export const metadata: Metadata = {
	title: "NextJS with TUS",
	description: "They said it couldn't be done... But here it is!",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang='en'>
			<body className='antialiased dark'>{children}</body>
		</html>
	);
}
