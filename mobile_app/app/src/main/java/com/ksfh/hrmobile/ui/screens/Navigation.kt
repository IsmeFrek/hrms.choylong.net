package com.ksfh.hrmobile.ui.screens

import androidx.compose.runtime.Composable
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController

@Composable
fun MainAppNavigation() {
    val navController = rememberNavController()

    NavHost(navController = navController, startDestination = "login") {
        composable("login") {
            LoginScreen(
                onLoginSuccess = { role ->
                    if (role == "manager") {
                        navController.navigate("manager_dashboard") {
                            popUpTo("login") { inclusive = true }
                        }
                    } else {
                        navController.navigate("staff_dashboard") {
                            popUpTo("login") { inclusive = true }
                        }
                    }
                }
            )
        }
        composable("staff_dashboard") {
            StaffDashboardScreen(
                onNavigateToAttendance = { navController.navigate("attendance") },
                onNavigateToLeave = { navController.navigate("leave_request") },
                onNavigateToPayslip = { navController.navigate("payslip") },
                onLogout = {
                    navController.navigate("login") {
                        popUpTo(0) { inclusive = true }
                    }
                }
            )
        }
        composable("manager_dashboard") {
            ManagerDashboardScreen(
                onNavigateToApprovals = { navController.navigate("approvals") },
                onNavigateToTeamAttendance = { navController.navigate("team_attendance") },
                onLogout = {
                    navController.navigate("login") {
                        popUpTo(0) { inclusive = true }
                    }
                }
            )
        }
        composable("attendance") {
            AttendanceScreen(onBack = { navController.popBackStack() })
        }
        composable("leave_request") {
            LeaveRequestScreen(onBack = { navController.popBackStack() })
        }
        composable("payslip") {
            PayslipScreen(onBack = { navController.popBackStack() })
        }
        composable("approvals") {
            ApprovalScreen(onBack = { navController.popBackStack() })
        }
        composable("team_attendance") {
            TeamAttendanceScreen(onBack = { navController.popBackStack() })
        }
    }
}
