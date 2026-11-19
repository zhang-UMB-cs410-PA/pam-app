const API_URL = process.env.EXPO_PUBLIC_API_URL;

export async function saveMemory(content: string) {
    if (!API_URL) {
        throw new Error("API URL is missing");
    }

    const response = await fetch(`${API_URL}/memories`, {
        method: "POST",
        headers: {
            "Content-Type": "applsication/json"
        },
        body: JSON.stringify({ content })
    });
    
    if (!response.ok) {
        throw new Error('Save failesd: $(response.status)');
    }

    return response.json();
}

export async function searchMemories(question: string) {
    if (!API_URL) {
        throw new Error("API URL is missing");
    }

    const response = await fetch(`${API_URL}/memories/search`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ question })
    });

    if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
    }

    return response.json();
}