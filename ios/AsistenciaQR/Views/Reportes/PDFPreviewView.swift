import SwiftUI
import PDFKit

struct PDFPreviewView: View {
    let pdfURL: URL
    let titulo: String
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                PDFKitContainerView(url: pdfURL)
                    .background(Color(UIColor.secondarySystemBackground))
            }
            .navigationTitle(titulo)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cerrar") {
                        dismiss()
                    }
                }
                
                ToolbarItem(placement: .primaryAction) {
                    ShareLink(
                        item: pdfURL,
                        preview: SharePreview(
                            titulo,
                            icon: Image(systemName: "doc.text.fill")
                        )
                    ) {
                        Label("Descargar / Compartir", systemImage: "square.and.arrow.up")
                            .fontWeight(.semibold)
                    }
                }
            }
        }
    }
}

// Representación UIViewRepresentable de PDFView
struct PDFKitContainerView: UIViewRepresentable {
    let url: URL
    
    func makeUIView(context: Context) -> PDFView {
        let pdfView = PDFView()
        pdfView.autoScales = true
        pdfView.displayMode = .singlePageContinuous
        pdfView.displayDirection = .vertical
        pdfView.document = PDFDocument(url: url)
        pdfView.backgroundColor = UIColor.secondarySystemBackground
        return pdfView
    }
    
    func updateUIView(_ uiView: PDFView, context: Context) {
        if uiView.document?.documentURL != url {
            uiView.document = PDFDocument(url: url)
        }
    }
}
