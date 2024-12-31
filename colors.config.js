const getColor = (colorIndex) => {
    switch (colorIndex) {
        case "1":
            return {
                border: "#fb464c",
                background: "#c33a3f",
                foreground: "#ffffff"
            };
        case "2":
            return {
                border: "#ff8000",
                background: "#ff8000",
                foreground: "#000000"
            };
        case "3":
            return {
                border: "#e0de71",
                background: "#b1af5c",
                foreground: "#000000"
            };
        case "4":
            return {
                border: "#00ff00",
                background: "#00ff00",
                foreground: "#ffffff"
            };
        case "5":
            return {
                border: "#0000ff",
                background: "#0000ff",
                foreground: "#ffffff"
            };
        case "6":
            return {
                border: "#00ffff",
                background: "#00ffff",
                foreground: "#ffffff"
            };
        case "7":
            return {
                border: "#ff00ff",
                background: "#ff00ff",
                foreground: "#ffffff"
            };
        default:
            return {
                border: "#7e7e7e",
                background: "#2b2b2b",
                foreground: "#7e7e7e"
            };
    }
}