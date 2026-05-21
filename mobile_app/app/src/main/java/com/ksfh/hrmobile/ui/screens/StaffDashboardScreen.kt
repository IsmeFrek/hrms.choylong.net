package com.ksfh.hrmobile.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.Logout
import androidx.compose.material.icons.outlined.Shield
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun StaffDashboardScreen(
    onNavigateToAttendance: () -> Unit,
    onNavigateToLeave: () -> Unit,
    onNavigateToPayslip: () -> Unit,
    onLogout: () -> Unit
) {
    val primaryBlue = Color(0xFF3498DB)
    val backgroundBlue = Color(0xFFF0F7FF)
    val greenBtn = Color(0xFF4CAF50)
    val redBtn = Color(0xFFE53935)
    val lightGreenBtn = Color(0xFF81C784)
    val lightRedBtn = Color(0xFFE57373)

    Scaffold(
        bottomBar = {
            NavigationBar(
                containerColor = Color.White,
                tonalElevation = 8.dp,
                modifier = Modifier.height(70.dp)
            ) {
                NavigationBarItem(
                    icon = { Icon(Icons.Default.Home, contentDescription = null, tint = primaryBlue) },
                    label = { Text("ទំព័រដើម", fontSize = 10.sp) },
                    selected = true,
                    onClick = {}
                )
                NavigationBarItem(
                    icon = { Icon(Icons.Default.History, contentDescription = null) },
                    label = { Text("វត្តមាន", fontSize = 10.sp) },
                    selected = false,
                    onClick = {}
                )
                NavigationBarItem(
                    icon = { Icon(Icons.Default.Mail, contentDescription = null) },
                    label = { Text("សារ", fontSize = 10.sp) },
                    selected = false,
                    onClick = {}
                )
                NavigationBarItem(
                    icon = { Icon(Icons.Default.Settings, contentDescription = null) },
                    label = { Text("កំណត់", fontSize = 10.sp) },
                    selected = false,
                    onClick = {}
                )
            }
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .background(backgroundBlue)
        ) {
            // --- Header Section: ABC CORP ---
            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(primaryBlue)
                        .padding(horizontal = 16.dp, vertical = 20.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    // Logo & Brand
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Default.Park,
                            contentDescription = null,
                            tint = Color.White,
                            modifier = Modifier.size(35.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Column {
                            Text("ABC", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 20.sp, lineHeight = 18.sp)
                            Text("CORP", color = Color.White, fontWeight = FontWeight.Normal, fontSize = 16.sp, lineHeight = 14.sp)
                        }
                    }

                    // User Profile
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Column(horizontalAlignment = Alignment.End) {
                            Text("សួស្ដី, សុខ", color = Color.White, fontSize = 14.sp)
                            Text("Sophat Sok", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Light)
                        }
                        Spacer(modifier = Modifier.width(8.dp))
                        AsyncImage(
                            model = "https://ui-avatars.com/api/?name=Sophat+Sok&background=random",
                            contentDescription = null,
                            modifier = Modifier
                                .size(45.dp)
                                .clip(CircleShape)
                                .border(1.dp, Color.White, CircleShape),
                            contentScale = ContentScale.Crop
                        )
                    }
                }
            }

            // --- Personal Info Card ---
            item {
                Card(
                    modifier = Modifier
                        .padding(top = 16.dp, start = 16.dp, end = 16.dp)
                        .fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            text = "ព័ត៌មានផ្ទាល់ខ្លួន",
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold,
                            color = primaryBlue
                        )
                        Spacer(modifier = Modifier.height(12.dp))

                        // Row 1: ID
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.Badge, contentDescription = null, tint = primaryBlue, modifier = Modifier.size(20.dp))
                            Spacer(modifier = Modifier.width(12.dp))
                            Column {
                                Text("អត្តលេខ", fontSize = 11.sp, color = Color.Gray)
                                Text("ABC-00124", fontSize = 14.sp, fontWeight = FontWeight.Medium)
                            }
                        }

                        HorizontalDivider(modifier = Modifier.padding(vertical = 10.dp), thickness = 0.5.dp, color = Color(0xFFEEEEEE))

                        // Row 2: Department
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.Business, contentDescription = null, tint = primaryBlue, modifier = Modifier.size(20.dp))
                            Spacer(modifier = Modifier.width(12.dp))
                            Column {
                                Text("ផ្នែក", fontSize = 11.sp, color = Color.Gray)
                                Text("បច្ចេកវិទ្យា (IT)", fontSize = 14.sp, fontWeight = FontWeight.Medium)
                            }
                        }

                        HorizontalDivider(modifier = Modifier.padding(vertical = 10.dp), thickness = 0.5.dp, color = Color(0xFFEEEEEE))

                        // Row 3: Position
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.Work, contentDescription = null, tint = primaryBlue, modifier = Modifier.size(20.dp))
                            Spacer(modifier = Modifier.width(12.dp))
                            Column {
                                Text("តួនាទី", fontSize = 11.sp, color = Color.Gray)
                                Text("អ្នកជំនាញផ្នែកទន់", fontSize = 14.sp, fontWeight = FontWeight.Medium)
                            }
                        }
                    }
                }
            }

            // --- Face Scan Card ---
            item {
                Card(
                    modifier = Modifier
                        .padding(16.dp)
                        .fillMaxWidth(),
                    shape = RoundedCornerShape(24.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(
                            "ចុះវត្តមានថ្ងៃនេះ",
                            style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                            modifier = Modifier.padding(bottom = 16.dp)
                        )

                        // Scanner Box
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(220.dp)
                                .clip(RoundedCornerShape(16.dp))
                                .background(Color.LightGray),
                            contentAlignment = Alignment.Center
                        ) {
                            AsyncImage(
                                model = "https://ui-avatars.com/api/?name=User&size=200",
                                contentDescription = null,
                                modifier = Modifier.fillMaxSize(),
                                contentScale = ContentScale.Crop
                            )
                            // Target Circle
                            Box(
                                modifier = Modifier
                                    .size(160.dp)
                                    .border(2.dp, Color(0xFF00FF00).copy(alpha = 0.6f), CircleShape)
                            )
                        }

                        Spacer(modifier = Modifier.height(20.dp))

                        // Grid Buttons in Card
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            AttendanceActionButton(
                                text = "ស្កេនចូល 1",
                                icon = Icons.Outlined.Shield,
                                color = greenBtn,
                                modifier = Modifier.weight(1f),
                                onClick = onNavigateToAttendance
                            )
                            AttendanceActionButton(
                                text = "ស្កេនចេញ 1",
                                icon = Icons.Outlined.Logout,
                                color = redBtn,
                                modifier = Modifier.weight(1f),
                                onClick = {}
                            )
                        }

                        Spacer(modifier = Modifier.height(8.dp))

                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            AttendanceActionButton(
                                text = "ស្កេនចូល 2",
                                icon = Icons.Outlined.Shield,
                                color = lightGreenBtn,
                                modifier = Modifier.weight(1f),
                                onClick = {}
                            )
                            AttendanceActionButton(
                                text = "ស្កេនចេញ 2",
                                icon = Icons.Outlined.Logout,
                                color = lightRedBtn,
                                modifier = Modifier.weight(1f),
                                onClick = {}
                            )
                        }
                    }
                }
            }

            // --- Features List ---
            item {
                Row(
                    modifier = Modifier.padding(horizontal = 16.dp).fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    BigFeatureCard(
                        title = "ប្រតិទិន",
                        subtitle = "Calendar",
                        icon = Icons.Default.CalendarMonth,
                        modifier = Modifier.weight(1f),
                        onClick = {}
                    )
                    BigFeatureCard(
                        title = "ស្នើសុំច្បាប់",
                        subtitle = "Leave Request",
                        icon = Icons.Default.Description,
                        modifier = Modifier.weight(1f),
                        onClick = onNavigateToLeave
                    )
                }
            }

            item {
                Spacer(modifier = Modifier.height(12.dp))
                Row(
                    modifier = Modifier.padding(horizontal = 16.dp).fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    SmallGridCard(
                        title = "ចុះយកវត្តមាន",
                        subtitle = "Add Field Atten...",
                        icon = Icons.Default.AddLocationAlt,
                        modifier = Modifier.weight(1f),
                        onClick = {}
                    )
                    SmallGridCard(
                        title = "វត្តមានប្រជុំ",
                        subtitle = "Meeting",
                        icon = Icons.Default.Handshake,
                        modifier = Modifier.weight(1f),
                        onClick = {}
                    )
                    SmallGridCard(
                        title = "កូនក្រុម (មេផ្នែក)",
                        subtitle = "Team Head View",
                        icon = Icons.Default.AccountTree,
                        badge = "35",
                        modifier = Modifier.weight(1f),
                        onClick = {}
                    )
                }
                Spacer(modifier = Modifier.height(20.dp))
            }
        }
    }
}

@Composable
fun AttendanceActionButton(text: String, icon: ImageVector, color: Color, modifier: Modifier, onClick: () -> Unit) {
    Button(
        onClick = onClick,
        colors = ButtonDefaults.buttonColors(containerColor = color),
        shape = RoundedCornerShape(50.dp),
        contentPadding = PaddingValues(horizontal = 8.dp),
        modifier = modifier.height(48.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(icon, contentDescription = null, modifier = Modifier.size(20.dp))
            Spacer(modifier = Modifier.width(4.dp))
            Text(text, fontSize = 13.sp, fontWeight = FontWeight.Medium)
        }
    }
}

@Composable
fun BigFeatureCard(title: String, subtitle: String, icon: ImageVector, modifier: Modifier, onClick: () -> Unit) {
    Card(
        modifier = modifier.height(85.dp).clickable { onClick() },
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxSize().padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier.size(45.dp).clip(RoundedCornerShape(10.dp)).background(Color(0xFFF0F4F8)),
                contentAlignment = Alignment.Center
            ) {
                Icon(icon, contentDescription = null, tint = Color(0xFF3498DB), modifier = Modifier.size(28.dp))
            }
            Spacer(modifier = Modifier.width(12.dp))
            Column {
                Text(title, fontSize = 14.sp, fontWeight = FontWeight.Bold, color = Color.Black)
                Text(subtitle, fontSize = 11.sp, color = Color.Gray)
            }
        }
    }
}

@Composable
fun SmallGridCard(title: String, subtitle: String, icon: ImageVector, badge: String? = null, modifier: Modifier, onClick: () -> Unit) {
    Card(
        modifier = modifier.height(110.dp).clickable { onClick() },
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Box(modifier = Modifier.fillMaxSize()) {
            Column(
                modifier = Modifier.fillMaxSize().padding(8.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                Icon(icon, contentDescription = null, tint = Color(0xFF3498DB), modifier = Modifier.size(28.dp))
                Spacer(modifier = Modifier.height(8.dp))
                Text(title, fontSize = 10.sp, fontWeight = FontWeight.Bold, color = Color.Black, textAlign = TextAlign.Center, lineHeight = 12.sp)
                Text(subtitle, fontSize = 8.sp, color = Color.Gray, textAlign = TextAlign.Center)
            }
            if (badge != null) {
                Surface(
                    color = Color(0xFF3498DB),
                    shape = CircleShape,
                    modifier = Modifier.align(Alignment.TopEnd).padding(6.dp).size(18.dp)
                ) {
                    Text(badge, color = Color.White, fontSize = 9.sp, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 1.dp))
                }
            }
        }
    }
}
