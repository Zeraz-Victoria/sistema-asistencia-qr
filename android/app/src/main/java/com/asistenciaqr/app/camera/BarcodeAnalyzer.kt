package com.asistenciaqr.app.camera

import android.annotation.SuppressLint
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.common.InputImage

class BarcodeAnalyzer(
    private val onBarcodeDetected: (String) -> Unit
) : ImageAnalysis.Analyzer {

    private val scanner = BarcodeScanning.getClient()
    private var lastScannedCode: String? = null
    private var lastScannedTime: Long = 0L

    @SuppressLint("UnsafeOptInUsageError")
    override fun analyze(imageProxy: ImageProxy) {
        val mediaImage = imageProxy.image
        if (mediaImage == null) {
            imageProxy.close()
            return
        }

        // Freno de 1 segundo (1000 ms) entre lecturas
        val now = System.currentTimeMillis()
        if (now - lastScannedTime < 1000L) {
            imageProxy.close()
            return
        }

        val image = InputImage.fromMediaImage(mediaImage, imageProxy.imageInfo.rotationDegrees)
        scanner.process(image)
            .addOnSuccessListener { barcodes ->
                for (barcode in barcodes) {
                    val code = barcode.rawValue
                    if (!code.isNullOrBlank()) {
                        val currentTime = System.currentTimeMillis()
                        if (currentTime - lastScannedTime >= 1000L) {
                            lastScannedTime = currentTime
                            lastScannedCode = code
                            onBarcodeDetected(code)
                            break
                        }
                    }
                }
            }
            .addOnFailureListener {
                // Log or ignore
            }
            .addOnCompleteListener {
                imageProxy.close()
            }
    }
}
