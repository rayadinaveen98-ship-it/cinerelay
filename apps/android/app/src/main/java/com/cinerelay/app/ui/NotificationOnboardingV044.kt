package com.cinerelay.app.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.SmartDisplay
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.cinerelay.app.data.SourceDirectoryItem

private val OnboardingInk = Color(0xFF090B0F)
private val OnboardingPanel = Color(0xFF15181E)
private val OnboardingRaised = Color(0xFF1C2028)
private val OnboardingLine = Color(0xFF2A303A)
private val OnboardingText = Color(0xFFF5F1E8)
private val OnboardingMuted = Color(0xFFA7ADB7)
private val OnboardingGold = Color(0xFFE7C36B)
private val OnboardingGreen = Color(0xFF72D6A4)
private val OnboardingRed = Color(0xFFF08079)

@Composable
fun NotificationOnboardingV044(
    state: NotificationOnboardingState,
    onRetry: () -> Unit,
    onToggleSource: (String) -> Unit,
    onSetVideos: (Boolean) -> Unit,
    onSetShorts: (Boolean) -> Unit,
    onValidateSelection: () -> Boolean,
    onEnableNotifications: () -> Unit,
    onFinishWithoutNotifications: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var step by remember { mutableIntStateOf(0) }

    Surface(modifier = modifier.fillMaxSize(), color = OnboardingInk) {
        when {
            !state.setupKnown && state.error == null -> LoadingSetup()
            !state.setupKnown -> SetupFailure(state.error.orEmpty(), onRetry)
            else -> Column(
                modifier = Modifier
                    .fillMaxSize()
                    .statusBarsPadding()
                    .navigationBarsPadding(),
            ) {
                OnboardingProgress(step = step, onBack = { if (step > 0 && !state.saving) step -= 1 })
                state.error?.let { InlineOnboardingError(it) }
                when (step) {
                    0 -> WelcomeStep(state.sources.size) { step = 1 }
                    1 -> SourceSelectionStep(
                        sources = state.sources,
                        selectedIds = state.selectedSourceIds,
                        saving = state.saving,
                        onToggle = onToggleSource,
                        onContinue = { if (onValidateSelection()) step = 2 },
                    )
                    2 -> ContentTypeStep(
                        includeVideos = state.includeVideos,
                        includeShorts = state.includeShorts,
                        saving = state.saving,
                        onSetVideos = onSetVideos,
                        onSetShorts = onSetShorts,
                        onContinue = { step = 3 },
                    )
                    else -> PermissionStep(
                        selectedCount = state.selectedSourceIds.size,
                        includeVideos = state.includeVideos,
                        includeShorts = state.includeShorts,
                        saving = state.saving,
                        onEnableNotifications = onEnableNotifications,
                        onNotNow = onFinishWithoutNotifications,
                    )
                }
            }
        }
    }
}

@Composable
private fun LoadingSetup() {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            BrandOrb()
            Spacer(Modifier.height(20.dp))
            CircularProgressIndicator(color = OnboardingGold, strokeWidth = 2.dp)
            Spacer(Modifier.height(12.dp))
            Text("Preparing CineRelay", color = OnboardingMuted, fontSize = 12.sp)
        }
    }
}

@Composable
private fun SetupFailure(message: String, onRetry: () -> Unit) {
    Box(Modifier.fillMaxSize().padding(28.dp), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            BrandOrb()
            Spacer(Modifier.height(18.dp))
            Text("Setup could not load", color = OnboardingText, fontSize = 20.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(8.dp))
            Text(message, color = OnboardingMuted, fontSize = 12.sp)
            Spacer(Modifier.height(20.dp))
            Button(
                onClick = onRetry,
                colors = ButtonDefaults.buttonColors(containerColor = OnboardingGold, contentColor = OnboardingInk),
            ) { Text("Try again", fontWeight = FontWeight.Bold) }
        }
    }
}

@Composable
private fun OnboardingProgress(step: Int, onBack: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (step > 0) {
            IconButton(onClick = onBack) {
                Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = OnboardingText)
            }
        } else {
            Spacer(Modifier.size(48.dp))
        }
        Row(
            modifier = Modifier.weight(1f),
            horizontalArrangement = Arrangement.Center,
        ) {
            repeat(4) { index ->
                Surface(
                    color = if (index <= step) OnboardingGold else OnboardingLine,
                    shape = CircleShape,
                    modifier = Modifier.padding(horizontal = 3.dp).size(if (index == step) 9.dp else 7.dp),
                ) {}
            }
        }
        Text("${step + 1}/4", color = OnboardingMuted, fontSize = 10.sp, modifier = Modifier.padding(end = 12.dp))
    }
}

@Composable
private fun WelcomeStep(sourceCount: Int, onContinue: () -> Unit) {
    Column(
        modifier = Modifier.fillMaxSize().padding(horizontal = 28.dp, vertical = 24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Spacer(Modifier.weight(0.35f))
        BrandOrb()
        Spacer(Modifier.height(22.dp))
        Text("CINERELAY", color = OnboardingGold, fontSize = 11.sp, fontWeight = FontWeight.Black, letterSpacing = 2.sp)
        Spacer(Modifier.height(8.dp))
        Text(
            "Every official update.\nOne cinema feed.",
            color = OnboardingText,
            fontSize = 30.sp,
            lineHeight = 36.sp,
            fontWeight = FontWeight.Bold,
        )
        Spacer(Modifier.height(16.dp))
        Text(
            "CineRelay monitors official cinema sources continuously. You choose exactly which channels are allowed to interrupt you.",
            color = OnboardingMuted,
            fontSize = 14.sp,
            lineHeight = 21.sp,
        )
        Spacer(Modifier.height(22.dp))
        Surface(color = OnboardingGold.copy(alpha = 0.10f), shape = RoundedCornerShape(16.dp)) {
            Text(
                "$sourceCount official YouTube sources ready",
                color = OnboardingGold,
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(horizontal = 15.dp, vertical = 10.dp),
            )
        }
        Spacer(Modifier.weight(1f))
        PrimaryOnboardingButton("Choose my sources", onContinue)
    }
}

@Composable
private fun SourceSelectionStep(
    sources: List<SourceDirectoryItem>,
    selectedIds: Set<String>,
    saving: Boolean,
    onToggle: (String) -> Unit,
    onContinue: () -> Unit,
) {
    var query by remember { mutableStateOf("") }
    val filtered = remember(sources, query) {
        val needle = query.trim().lowercase()
        if (needle.isBlank()) sources else sources.filter {
            it.name.lowercase().contains(needle) ||
                it.handle?.lowercase()?.contains(needle) == true ||
                prettyRole(it.role).lowercase().contains(needle)
        }
    }

    Column(Modifier.fillMaxSize()) {
        Column(Modifier.padding(horizontal = 20.dp)) {
            Text("Choose who can notify you", color = OnboardingText, fontSize = 24.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(5.dp))
            Text(
                "CineRelay still monitors every source. Only the channels you check here can send upload notifications.",
                color = OnboardingMuted,
                fontSize = 12.sp,
                lineHeight = 18.sp,
            )
            Spacer(Modifier.height(14.dp))
            OutlinedTextField(
                value = query,
                onValueChange = { query = it },
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                placeholder = { Text("Search 90 sources") },
                singleLine = true,
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = OnboardingGold,
                    unfocusedBorderColor = OnboardingLine,
                    focusedTextColor = OnboardingText,
                    unfocusedTextColor = OnboardingText,
                    focusedLeadingIconColor = OnboardingGold,
                    unfocusedLeadingIconColor = OnboardingMuted,
                    focusedPlaceholderColor = OnboardingMuted,
                    unfocusedPlaceholderColor = OnboardingMuted,
                ),
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(10.dp))
            Text(
                "${selectedIds.size} selected",
                color = if (selectedIds.isEmpty()) OnboardingMuted else OnboardingGreen,
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
            )
        }

        LazyColumn(
            modifier = Modifier.weight(1f),
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 10.dp),
            verticalArrangement = Arrangement.spacedBy(7.dp),
        ) {
            items(filtered, key = { it.identityId }) { source ->
                SelectableSourceRow(
                    source = source,
                    selected = source.identityId in selectedIds,
                    enabled = !saving,
                    onClick = { onToggle(source.identityId) },
                )
            }
        }

        Surface(color = OnboardingInk, modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.padding(horizontal = 20.dp, vertical = 12.dp)) {
                PrimaryOnboardingButton(
                    text = if (selectedIds.isEmpty()) "Select at least one source" else "Continue with ${selectedIds.size}",
                    onClick = onContinue,
                    enabled = selectedIds.isNotEmpty() && !saving,
                )
            }
        }
    }
}

@Composable
private fun SelectableSourceRow(
    source: SourceDirectoryItem,
    selected: Boolean,
    enabled: Boolean,
    onClick: () -> Unit,
) {
    Surface(
        color = if (selected) OnboardingGold.copy(alpha = 0.08f) else OnboardingPanel,
        shape = RoundedCornerShape(16.dp),
        modifier = Modifier.fillMaxWidth().clickable(enabled = enabled, onClick = onClick),
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            InitialsOrb(source.name)
            Spacer(Modifier.size(10.dp))
            Column(Modifier.weight(1f)) {
                Text(
                    source.name,
                    color = OnboardingText,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    listOfNotNull(prettyRole(source.role), source.handle).filter { it.isNotBlank() }.joinToString(" • "),
                    color = OnboardingMuted,
                    fontSize = 9.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            Checkbox(
                checked = selected,
                onCheckedChange = { onClick() },
                enabled = enabled,
                colors = CheckboxDefaults.colors(checkedColor = OnboardingGold, checkmarkColor = OnboardingInk),
            )
        }
    }
}

@Composable
private fun ContentTypeStep(
    includeVideos: Boolean,
    includeShorts: Boolean,
    saving: Boolean,
    onSetVideos: (Boolean) -> Unit,
    onSetShorts: (Boolean) -> Unit,
    onContinue: () -> Unit,
) {
    Column(Modifier.fillMaxSize().padding(horizontal = 22.dp, vertical = 18.dp)) {
        Text("What should interrupt you?", color = OnboardingText, fontSize = 24.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(7.dp))
        Text("These choices apply only to the sources you selected.", color = OnboardingMuted, fontSize = 12.sp)
        Spacer(Modifier.height(24.dp))
        PreferenceSwitch(
            icon = { Icon(Icons.Default.SmartDisplay, contentDescription = null, tint = OnboardingGold) },
            title = "New videos",
            body = "Trailers, songs, announcements and normal uploads from your selected channels.",
            checked = includeVideos,
            onCheckedChange = onSetVideos,
            enabled = !saving,
        )
        Spacer(Modifier.height(12.dp))
        PreferenceSwitch(
            icon = { Icon(Icons.Default.Notifications, contentDescription = null, tint = OnboardingMuted) },
            title = "YouTube Shorts",
            body = "Off by default. Turn this on only if you also want short-form upload alerts.",
            checked = includeShorts,
            onCheckedChange = onSetShorts,
            enabled = !saving,
        )
        Spacer(Modifier.height(18.dp))
        Surface(color = OnboardingGreen.copy(alpha = 0.08f), shape = RoundedCornerShape(16.dp)) {
            Text(
                "CineRelay will never use channels you did not select to create upload notifications.",
                color = OnboardingGreen,
                fontSize = 11.sp,
                lineHeight = 17.sp,
                modifier = Modifier.padding(14.dp),
            )
        }
        Spacer(Modifier.weight(1f))
        PrimaryOnboardingButton("Continue", onContinue, enabled = (includeVideos || includeShorts) && !saving)
    }
}

@Composable
private fun PreferenceSwitch(
    icon: @Composable () -> Unit,
    title: String,
    body: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
    enabled: Boolean,
) {
    Surface(color = OnboardingPanel, shape = RoundedCornerShape(18.dp), modifier = Modifier.fillMaxWidth()) {
        Row(Modifier.padding(15.dp), verticalAlignment = Alignment.CenterVertically) {
            Surface(color = OnboardingRaised, shape = CircleShape, modifier = Modifier.size(42.dp)) {
                Box(contentAlignment = Alignment.Center) { icon() }
            }
            Spacer(Modifier.size(12.dp))
            Column(Modifier.weight(1f)) {
                Text(title, color = OnboardingText, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(3.dp))
                Text(body, color = OnboardingMuted, fontSize = 10.sp, lineHeight = 15.sp)
            }
            Switch(
                checked = checked,
                onCheckedChange = onCheckedChange,
                enabled = enabled,
                colors = SwitchDefaults.colors(checkedThumbColor = OnboardingInk, checkedTrackColor = OnboardingGold),
            )
        }
    }
}

@Composable
private fun PermissionStep(
    selectedCount: Int,
    includeVideos: Boolean,
    includeShorts: Boolean,
    saving: Boolean,
    onEnableNotifications: () -> Unit,
    onNotNow: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxSize().padding(horizontal = 24.dp, vertical = 20.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Spacer(Modifier.weight(0.25f))
        Surface(color = OnboardingGold.copy(alpha = 0.12f), shape = CircleShape, modifier = Modifier.size(76.dp)) {
            Box(contentAlignment = Alignment.Center) {
                Icon(Icons.Default.Notifications, contentDescription = null, tint = OnboardingGold, modifier = Modifier.size(34.dp))
            }
        }
        Spacer(Modifier.height(22.dp))
        Text("Ready when you are", color = OnboardingText, fontSize = 26.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(7.dp))
        Text(
            "Android will ask for notification permission next. CineRelay will use it only for the sources and upload types below.",
            color = OnboardingMuted,
            fontSize = 12.sp,
            lineHeight = 18.sp,
        )
        Spacer(Modifier.height(22.dp))
        Surface(color = OnboardingPanel, shape = RoundedCornerShape(20.dp), modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp)) {
                SummaryLine("Selected channels", selectedCount.toString())
                HorizontalDivider(color = OnboardingLine, modifier = Modifier.padding(vertical = 10.dp))
                SummaryLine("Videos", if (includeVideos) "On" else "Off")
                HorizontalDivider(color = OnboardingLine, modifier = Modifier.padding(vertical = 10.dp))
                SummaryLine("Shorts", if (includeShorts) "On" else "Off")
            }
        }
        Spacer(Modifier.weight(1f))
        if (saving) {
            CircularProgressIndicator(color = OnboardingGold, strokeWidth = 2.dp)
            Spacer(Modifier.height(15.dp))
            Text("Saving your notification desk…", color = OnboardingMuted, fontSize = 11.sp)
        } else {
            PrimaryOnboardingButton("Enable notifications", onEnableNotifications)
            Spacer(Modifier.height(6.dp))
            TextButton(onClick = onNotNow) {
                Text("Not now — save my sources only", color = OnboardingMuted, fontSize = 11.sp)
            }
        }
    }
}

@Composable
private fun SummaryLine(label: String, value: String) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text(label, color = OnboardingMuted, fontSize = 11.sp, modifier = Modifier.weight(1f))
        Text(value, color = OnboardingText, fontSize = 12.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun InlineOnboardingError(message: String) {
    Surface(
        color = OnboardingRed.copy(alpha = 0.10f),
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier.padding(horizontal = 20.dp, vertical = 4.dp).fillMaxWidth(),
    ) {
        Text(message, color = OnboardingRed, fontSize = 10.sp, modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp))
    }
}

@Composable
private fun PrimaryOnboardingButton(text: String, onClick: () -> Unit, enabled: Boolean = true) {
    Button(
        onClick = onClick,
        enabled = enabled,
        colors = ButtonDefaults.buttonColors(
            containerColor = OnboardingGold,
            contentColor = OnboardingInk,
            disabledContainerColor = OnboardingLine,
            disabledContentColor = OnboardingMuted,
        ),
        shape = RoundedCornerShape(15.dp),
        modifier = Modifier.fillMaxWidth().height(52.dp),
    ) {
        Text(text, fontSize = 13.sp, fontWeight = FontWeight.Black)
    }
}

@Composable
private fun BrandOrb() {
    Surface(color = OnboardingGold.copy(alpha = 0.08f), shape = RoundedCornerShape(24.dp), modifier = Modifier.size(82.dp)) {
        Box(contentAlignment = Alignment.Center) {
            Icon(
                painter = androidx.compose.ui.res.painterResource(com.cinerelay.app.R.drawable.ic_cinerelay_mark),
                contentDescription = null,
                tint = Color.Unspecified,
                modifier = Modifier.size(72.dp),
            )
        }
    }
}

@Composable
private fun InitialsOrb(name: String) {
    val initials = name
        .split(' ')
        .filter { it.isNotBlank() }
        .take(2)
        .joinToString("") { it.take(1).uppercase() }
        .ifBlank { "CR" }
    Surface(color = OnboardingGold.copy(alpha = 0.10f), shape = CircleShape, modifier = Modifier.size(38.dp)) {
        Box(contentAlignment = Alignment.Center) {
            Text(initials, color = OnboardingGold, fontSize = 10.sp, fontWeight = FontWeight.Bold)
        }
    }
}

private fun prettyRole(role: String?): String = when (role) {
    "PRODUCTION_HOUSE" -> "Production"
    "OTT_PLATFORM" -> "OTT"
    "MUSIC_LABEL" -> "Music"
    "MEDIA_LIBRARY" -> "Media"
    else -> role?.replace('_', ' ')?.lowercase()?.replaceFirstChar { it.titlecase() }.orEmpty()
}
