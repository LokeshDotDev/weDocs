const completeEditing = async (fileId) => {
	try {
		const response = await fetch(`/api/editor/${fileId}/complete`, {
			method: "POST",
		});
		if (response.ok) {
			console.log("Editing completed successfully");
		} else {
			console.error("Failed to complete editing");
		}
	} catch (error) {
		console.error("Error completing editing:", error);
	}
};

export default completeEditing;
