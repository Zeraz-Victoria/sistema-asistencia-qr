import SwiftUI
import CoreImage.CIFilterBuiltins

struct CredencialQRView: View {
    let alumno: Alumno
    var clases: [ClaseGrupo] = []
    @Environment(\.dismiss) private var dismiss
    @State private var formatoCredencial: String = "gafete"
    
    private let verdeOscuro = Color(red: 0.02, green: 0.37, blue: 0.27)
    private let verdeClaro = Color(red: 0.92, green: 0.99, blue: 0.96)
    private let verdeBorde = Color(red: 0.65, green: 0.95, blue: 0.82)
    
    var nombreClaseTexto: String {
        alumno.obtenerGrupo(clases: clases)
    }
    
    var qrCodeValue: String {
        alumno.codigo_qr ?? alumno.nfc_uid ?? "ALU-\(alumno.id)"
    }
    
    var qrImage: UIImage? {
        let context = CIContext()
        let filter = CIFilter.qrCodeGenerator()
        filter.message = Data(qrCodeValue.utf8)
        
        if let outputImage = filter.outputImage {
            let transform = CGAffineTransform(scaleX: 10, y: 10)
            let scaledImage = outputImage.transformed(by: transform)
            if let cgImage = context.createCGImage(scaledImage, from: scaledImage.extent) {
                return UIImage(cgImage: cgImage)
            }
        }
        return nil
    }
    
    // Gafete Credencial (1:1 con la web)
    var gafeteCard: some View {
        VStack(spacing: 0) {
            HStack {
                Text("CREDENCIAL DE ALUMNO")
                    .font(.system(size: 11, weight: .heavy))
                    .foregroundColor(.white)
                    .tracking(0.8)
                
                Spacer()
                
                Text("QR ASISTENCIA")
                    .font(.system(size: 9, weight: .bold))
                    .foregroundColor(.white)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 3)
                    .background(Color.white.opacity(0.22))
                    .cornerRadius(4)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .background(verdeOscuro)
            
            HStack(spacing: 14) {
                if let img = qrImage {
                    Image(uiImage: img)
                        .interpolation(.none)
                        .resizable()
                        .scaledToFit()
                        .frame(width: 95, height: 95)
                        .background(Color.white)
                        .cornerRadius(8)
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .stroke(Color.gray.opacity(0.2), lineWidth: 1)
                        )
                }
                
                VStack(alignment: .leading, spacing: 4) {
                    Text(alumno.nombre_completo)
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(Color(red: 0.06, green: 0.09, blue: 0.16))
                        .lineLimit(2)
                    
                    HStack(spacing: 4) {
                        Text("Grupo:")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundColor(Color(red: 0.06, green: 0.09, blue: 0.16))
                        Text(nombreClaseTexto)
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundColor(.secondary)
                    }
                    
                    Text(qrCodeValue)
                        .font(.system(size: 10, weight: .semibold, design: .monospaced))
                        .foregroundColor(verdeOscuro)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 3)
                        .background(verdeClaro)
                        .overlay(
                            RoundedRectangle(cornerRadius: 4)
                                .stroke(verdeBorde, lineWidth: 1)
                        )
                        .cornerRadius(4)
                        .padding(.top, 2)
                }
                
                Spacer(minLength: 0)
            }
            .padding(14)
            .background(Color.white)
        }
        .frame(width: 330)
        .cornerRadius(12)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.gray.opacity(0.25), lineWidth: 1)
        )
        .shadow(color: Color.black.opacity(0.08), radius: 8, y: 4)
    }
    
    // Sticker Card
    var stickerCard: some View {
        VStack(spacing: 8) {
            Text("CONTROL ESCOLAR")
                .font(.system(size: 10, weight: .bold))
                .foregroundColor(.secondary)
            
            if let img = qrImage {
                Image(uiImage: img)
                    .interpolation(.none)
                    .resizable()
                    .scaledToFit()
                    .frame(width: 130, height: 130)
                    .background(Color.white)
            }
            
            Text(alumno.nombre_completo)
                .font(.system(size: 13, weight: .bold))
                .multilineTextAlignment(.center)
                .lineLimit(1)
            
            Text(nombreClaseTexto)
                .font(.system(size: 11, weight: .semibold))
                .foregroundColor(.secondary)
            
            Text(qrCodeValue)
                .font(.system(size: 9, design: .monospaced))
                .foregroundColor(.gray)
        }
        .padding(16)
        .frame(width: 220)
        .background(Color.white)
        .cornerRadius(12)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.gray.opacity(0.25), lineWidth: 1)
        )
        .shadow(color: Color.black.opacity(0.08), radius: 8, y: 4)
    }
    
    @ViewBuilder
    var tarjetaRenderizable: some View {
        if formatoCredencial == "gafete" {
            gafeteCard
        } else {
            stickerCard
        }
    }
    
    @MainActor
    var imagenCredencialCompleta: UIImage? {
        let renderer = ImageRenderer(content: tarjetaRenderizable)
        renderer.scale = 3.0
        return renderer.uiImage
    }
    
    var body: some View {
        NavigationStack {
            VStack(spacing: 20) {
                Picker("Formato", selection: $formatoCredencial) {
                    Text("Gafete Escolar").tag("gafete")
                    Text("Sticker").tag("sticker")
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, 24)
                .padding(.top, 12)
                
                Spacer()
                
                tarjetaRenderizable
                    .padding(.horizontal, 16)
                
                Spacer()
                
                if let fullImage = imagenCredencialCompleta {
                    ShareLink(
                        item: Image(uiImage: fullImage),
                        preview: SharePreview("Credencial - \(alumno.nombre_completo)", image: Image(uiImage: fullImage))
                    ) {
                        Label("Imprimir / Compartir Credencial", systemImage: "printer.fill")
                            .font(.headline)
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .frame(height: 52)
                            .background(verdeOscuro)
                            .cornerRadius(14)
                    }
                    .padding(.horizontal, 24)
                    .padding(.bottom, 16)
                }
            }
            .background(Color(UIColor.systemGroupedBackground))
            .navigationTitle("Credencial QR")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cerrar") { dismiss() }
                }
            }
        }
    }
}
