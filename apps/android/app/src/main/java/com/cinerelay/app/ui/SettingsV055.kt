package com.cinerelay.app.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.Language
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.PlayCircle
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.VideoLibrary
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private val SettingsInk55 = CineEditorial.Background
private val SettingsPanel55 = CineEditorial.Surface
private val SettingsRaised55 = CineEditorial.Raised
private val SettingsText55 = CineEditorial.Text
private val SettingsMuted55 = CineEditorial.Muted
private val SettingsGold55 = CineEditorial.Accent
private val SettingsGreen55 = CineEditorial.Confirmed
private val SettingsRed55 = CineEditorial.Error

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsV055(
    state: CineRelayUiState,
    notificationState: NotificationOnboardingState,
    consumerState: ConsumerUiStateV055,
    onBack: () -> Unit,
    onEditFavorites: () -> Unit,
    onOpenSources: () -> Unit,
    onOpenCreatorIntelligence: () -> Unit,
    onToggleNotificationMaster: (Boolean) -> Unit,
    onSignOut: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val personalization = consumerState.personalization
    val favoriteCount = personalization?.favoriteSourceIdentityIds?.size ?: 0
    val languageLabels = personalization?.availableLanguages
        ?.filter { it.code in personalization.favoriteLanguages }
        ?.joinToString(", ") { it.label }
        .orEmpty()

    MaterialTheme(
        colorScheme = darkColorScheme(
            primary = SettingsGold55,
            background = SettingsInk55,
            surface = SettingsPanel55,
            surfaceVariant = SettingsRaised55,
            onBackground = SettingsText55,
            onSurface = SettingsText55,
            onSurfaceVariant = SettingsMuted55,
            error = SettingsRed55,
        ),
    ) {
        Surface(modifier = modifier.fillMaxSize(), color = SettingsInk55) {
            Column(Modifier.fillMaxSize()) {
                CineScreenHeader(title = "Settings", onBack = onBack)

                LazyColumn(
                    modifier = Modifier.weight(1f),
                    contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = CineEditorial.Gutter, vertical = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(22.dp),
                ) {
                    item {
                        SettingsSectionV055(title = "Account") {
                            SettingsInfoRowV055(
                                icon = { Icon(Icons.Default.Person, contentDescription = null, tint = SettingsGold55) },
                                title = state.email ?: "Signed in",
                                subtitle = "",
                            )
                        }
                    }

                    item {
                        SettingsSectionV055(title = "Preferences") {
                            SettingsActionRowV055(
                                icon = { Icon(Icons.Default.Favorite, contentDescription = null, tint = SettingsGold55) },
                                title = "Favorite channels",
                                subtitle = "$favoriteCount selected",
                                onClick = onEditFavorites,
                            )
                            SettingsDividerV055()
                            SettingsActionRowV055(
                                icon = { Icon(Icons.Default.Language, contentDescription = null, tint = SettingsGold55) },
                                title = "Languages",
                                subtitle = languageLabels.ifBlank { "Choose languages" },
                                onClick = onEditFavorites,
                            )
                        }
                    }

                    item {
                        SettingsSectionV055(title = "Notifications") {
                            Row(
                                modifier = Modifier.fillMaxWidth().padding(horizontal = 15.dp, vertical = 13.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Icon(Icons.Default.Notifications, contentDescription = null, tint = SettingsGold55, modifier = Modifier.size(24.dp))
                                Spacer(Modifier.width(12.dp))
                                Column(Modifier.weight(1f)) {
                                    Text("Movie update alerts", color = SettingsText55, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                                    Text(
                                        if (notificationState.masterEnabled) "On for ${notificationState.selectedSourceIds.size} channels"
                                        else "Paused — your channel choices are kept",
                                        color = if (notificationState.masterEnabled) SettingsGreen55 else SettingsMuted55,
                                        fontSize = 12.sp,
                                    )
                                }
                                Switch(
                                    checked = notificationState.masterEnabled,
                                    onCheckedChange = onToggleNotificationMaster,
                                    enabled = notificationState.setupCompleted && !notificationState.saving,
                                )
                            }
                            SettingsDividerV055()
                            SettingsInfoRowV055(
                                icon = { Icon(Icons.Default.PlayCircle, contentDescription = null, tint = SettingsMuted55) },
                                title = "Videos",
                                subtitle = if (notificationState.includeVideos) "Included in alerts" else "Not included",
                            )
                            SettingsDividerV055()
                            SettingsInfoRowV055(
                                icon = { Icon(Icons.Default.VideoLibrary, contentDescription = null, tint = SettingsMuted55) },
                                title = "Shorts",
                                subtitle = if (notificationState.includeShorts) "Included in alerts" else "Not included",
                            )
                            notificationState.error?.let {
                                Text(it, color = SettingsRed55, fontSize = 12.sp, modifier = Modifier.padding(horizontal = 15.dp, vertical = 8.dp))
                            }
                        }
                    }

                    item {
                        SettingsSectionV055(title = "Sources") {
                            SettingsActionRowV055(
                                icon = { Icon(Icons.Default.Settings, contentDescription = null, tint = SettingsGold55) },
                                title = "Manage channels",
                                subtitle = "",
                                onClick = onOpenSources,
                            )
                        }
                    }

                    item {
                        SettingsSectionV055(title = "Creator Lab · Beta") {
                            SettingsActionRowV055(
                                icon = { Icon(Icons.Default.VideoLibrary, contentDescription = null, tint = SettingsGold55) },
                                title = "Creator Intelligence",
                                subtitle = "Explore 94 research leads · verification pending",
                                onClick = onOpenCreatorIntelligence,
                            )
                        }
                    }

                    item {
                        SettingsSectionV055(title = "About") {
                            SettingsInfoRowV055(
                                icon = { Icon(Icons.Default.Settings, contentDescription = null, tint = SettingsMuted55) },
                                title = "CineRelay",
                                subtitle = "",
                            )
                        }
                    }

                    item {
                        Spacer(Modifier.height(4.dp))
                        Button(
                            onClick = onSignOut,
                            modifier = Modifier.fillMaxWidth(),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = SettingsRed55.copy(alpha = 0.12f),
                                contentColor = SettingsRed55,
                            ),
                        ) {
                            Text("Sign out", fontWeight = FontWeight.Bold)
                        }
                        Spacer(Modifier.height(80.dp))
                    }
                }
            }
        }
    }
}

@Composable
private fun SettingsSectionV055(
    title: String,
    content: @Composable () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        EditorialDisplayV2(title, modifier = Modifier.padding(horizontal = 4.dp),
            size = 18, lines = 1)
        Surface(color = SettingsPanel55, shape = RoundedCornerShape(CineEditorial.CardRadius), modifier = Modifier.fillMaxWidth()) {
            Column { content() }
        }
    }
}

@Composable
private fun SettingsActionRowV055(
    icon: @Composable () -> Unit,
    title: String,
    subtitle: String,
    onClick: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick).padding(horizontal = 15.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        BoxIconV055(icon)
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(title, color = SettingsText55, fontSize = CineEditorial.CardTitle, fontWeight = FontWeight.SemiBold)
            if (subtitle.isNotBlank()) {
                Text(subtitle, color = SettingsMuted55, fontSize = CineEditorial.Metadata, lineHeight = 16.sp)
            }
        }
        Icon(Icons.Default.ChevronRight, contentDescription = null, tint = SettingsMuted55)
    }
}

@Composable
private fun SettingsInfoRowV055(
    icon: @Composable () -> Unit,
    title: String,
    subtitle: String,
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 15.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        BoxIconV055(icon)
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(title, color = SettingsText55, fontSize = CineEditorial.CardTitle, fontWeight = FontWeight.SemiBold)
            if (subtitle.isNotBlank()) {
                Text(subtitle, color = SettingsMuted55, fontSize = CineEditorial.Metadata, lineHeight = 16.sp)
            }
        }
    }
}

@Composable
private fun BoxIconV055(content: @Composable () -> Unit) {
    Surface(color = SettingsRaised55, shape = RoundedCornerShape(12.dp), modifier = Modifier.size(42.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.Center) { content() }
    }
}

@Composable
private fun SettingsDividerV055() {
    Surface(color = SettingsRaised55, modifier = Modifier.fillMaxWidth().height(1.dp)) {}
}
