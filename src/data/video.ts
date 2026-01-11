export const video: Video = {
    id: "empty-video",
    object: "video",
    clips: [],
    created: Math.floor(Date.now() / 1000),
    metadata: {
        duration: 0,
        file_size: 0,
        mime_type: "video/mp4",
    },
    source: "",
    status: "pending",
    title: "Nenhum vídeo carregado"
}
