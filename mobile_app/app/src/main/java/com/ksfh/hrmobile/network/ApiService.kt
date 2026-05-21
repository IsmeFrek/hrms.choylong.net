package com.ksfh.hrmobile.network

import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST

interface ApiService {
    @POST("login")
    suspend fun login(@Body credentials: Map<String, String>): LoginResponse

    @GET("dashboard")
    suspend fun getDashboardData(): DashboardData

    companion object {
        // 10.0.2.2 គឺសម្រាប់ហៅទៅ localhost របស់កុំព្យូទ័រចេញពី Emulator
        private const val BASE_URL = "http://10.0.2.2:5000/" 

        fun create(): ApiService {
            val logger = HttpLoggingInterceptor().apply { 
                level = HttpLoggingInterceptor.Level.BODY 
            }
            
            val client = OkHttpClient.Builder()
                .addInterceptor(logger)
                .build()

            return Retrofit.Builder()
                .baseUrl(BASE_URL)
                .client(client)
                .addConverterFactory(GsonConverterFactory.create())
                .build()
                .create(ApiService::class.java)
        }
    }
}
