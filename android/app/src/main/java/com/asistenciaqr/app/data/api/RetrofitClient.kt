package com.asistenciaqr.app.data.api

import android.content.Context
import com.asistenciaqr.app.config.Config
import com.asistenciaqr.app.data.repository.AuthManager
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

object RetrofitClient {

    private var currentBaseUrl: String? = null
    private var cachedApiService: ApiService? = null

    fun getApiService(context: Context): ApiService {
        val baseUrl = Config.getApiBaseUrl(context).let {
            if (it.endsWith("/")) it else "$it/"
        }

        if (cachedApiService != null && currentBaseUrl == baseUrl) {
            return cachedApiService!!
        }

        val authManager = AuthManager.getInstance(context)

        val authInterceptor = Interceptor { chain ->
            val original = chain.request()
            val requestBuilder = original.newBuilder()

            val token = authManager.token
            if (!token.isNullOrBlank()) {
                requestBuilder.header("Authorization", "Bearer $token")
            }
            requestBuilder.header("Content-Type", "application/json")

            chain.proceed(requestBuilder.build())
        }

        val loggingInterceptor = HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BODY
        }

        val okHttpClient = OkHttpClient.Builder()
            .addInterceptor(authInterceptor)
            .addInterceptor(loggingInterceptor)
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(15, TimeUnit.SECONDS)
            .build()

        val retrofit = Retrofit.Builder()
            .baseUrl(baseUrl)
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()

        currentBaseUrl = baseUrl
        cachedApiService = retrofit.create(ApiService::class.java)
        return cachedApiService!!
    }

    fun invalidate() {
        cachedApiService = null
        currentBaseUrl = null
    }
}
