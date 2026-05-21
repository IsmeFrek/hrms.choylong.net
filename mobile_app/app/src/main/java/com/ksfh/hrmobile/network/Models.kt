package com.ksfh.hrmobile.network

import com.google.gson.annotations.SerializedName

data class LoginResponse(
    val success: Boolean,
    val message: String?,
    val token: String?,
    val role: String?,
    val user: User?
)

data class User(
    val id: Int,
    val name: String,
    val username: String
)

data class StaffProfile(
    val name: String,
    @SerializedName("shift_time") val shiftTime: String,
    val position: String
)

data class AttendanceRecord(
    val date: String,
    val status: String,
    val time: String
)

data class DashboardData(
    val profile: StaffProfile,
    val recentActivity: List<AttendanceRecord>
)
