package com.cinerelay.app.ui

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.OpenInNew
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import com.cinerelay.app.data.ConsumerDeepLinkTarget
import com.cinerelay.app.data.ConsumerEvidence

private val DetailInk = Color(0xFF0D0F13)
private val DetailPanel = Color(0xFF171A20)
private val DetailRaised = Color(0xFF20242C)
private val DetailText = Color(0xFFF4F1EA)
private val DetailMuted = Color(0xFFA8ADB7)
private val DetailGold = Color(0xFFE8C56D)
private val DetailGreen = Color(0xFF73D6A5)
private val DetailRed = Color(0xFFF08079)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NotificationDetailV055(
    state: ConsumerUiStateV055,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current

    MaterialTheme(
        colorScheme = darkColorScheme(
            primary = DetailGold,
            background = DetailInk,
            surface = DetailPanel,
            surfaceVariant = DetailRaised,
            onBackground = DetailText,
            onSurface = DetailText,
            onSurfaceVariant = DetailMuted,
            error = DetailRed,
        ),
    ) {
        Surface(modifier = modifier.fillMaxSize(), color = DetailInk) {
            Scaffold(
                containerColor = DetailInk,
                topBar = {
                    TopAppBar(
                        colors = TopAppBarDefaults.topAppBarColors(containerColor = DetailInk),
                        navigationIcon = {
                            IconButton(onClick = onBack) {
                                Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = DetailText)
                            }
                        },
                        title = {
                            Column {
                                Text("CINERELAY", color = DetailGold, fontSize = 9.sp, fontWeight = FontWeight.Black, letterSpacing = 1.5.sp)
                                Text("Update", color = DetailText, fontSize = 22.sp, fontWeight = FontWeight.Bold)
                            }
                        },
                    )
                },
            ) { padding ->
                when {
                    state.deepLinkLoading -> {
                        Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                            CircularProgressIndicator(color = DetailGold, strokeWidth = 2.dp)
                        }
                    }
                    state.deepLinkTarget != null -> {
                        when (val target = state.deepLinkTarget) {
                            is ConsumerDeepLinkTarget.SourceUpdate -> {
                                LazyColumn(
                                    modifier = Modifier.fillMaxSize().padding(padding),
                                    contentPadding = PaddingValues(start = 18.dp, end = 18.dp, top = 12.dp, bottom = 80.dp),
                                    verticalArrangement = Arrangement.spacedBy(16.dp),
                                ) {
                                    item {
                                        SourceUpdateDetailV055(target)
                                    }
                                }
                            }
                            is ConsumerDeepLinkTarget.Event -> {
                                LazyColumn(
                                    modifier = Modifier.fillMaxSize().padding(padding),
                                    contentPadding = PaddingValues(start = 18.dp, end = 18.dp, top = 12.dp, bottom = 80.dp),
                                    verticalArrangement = Arrangement.spacedBy(14.dp),
                                ) {
                                    item { EventDetailHeaderV055(target) }
                                    if (target.event.evidence.isNotEmpty()) {
                                        item {
                                            Text("Sources", color = DetailText, fontSize = 19.sp, fontWeight = FontWeight.Bold)
                                        }
                                        items(target.event.evidence) { evidence ->
                                            EventEvidenceCardV055(evidence)
                                        }
                                    }
                                }
                            }
                        }
                    }
                    else -> {
                        Column(
                            modifier = Modifier.fillMaxSize().padding(padding).padding(24.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.Center,
                        ) {
                            Text("This update isn't available in CineRelay anymore.", color = DetailText, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                            Spacer(Modifier.height(8.dp))
                            Text(state.deepLinkError ?: "The original post may still be available.", color = DetailMuted, fontSize = 13.sp, lineHeight = 19.sp)
                            state.deepLinkFallbackUrl?.let { url ->
                                Spacer(Modifier.height(18.dp))
                                Button(
                                    onClick = { runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) } },
                                    colors = ButtonDefaults.buttonColors(containerColor = DetailGold, contentColor = Color(0xFF241C09)),
                                ) {
                                    Icon(Icons.Default.OpenInNew, contentDescription = null, modifier = Modifier.size(17.dp))
                                    Spacer(Modifier.width(8.dp))
                                    Text("Open original", fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SourceUpdateDetailV055(target: ConsumerDeepLinkTarget.SourceUpdate) {
    val context = LocalContext.current
    val item = target.item
    Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            if (!item.source.artworkUrl.isNullOrBlank()) {
                AsyncImage(
                    model = item.source.artworkUrl,
                    contentDescription = item.source.name,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.size(46.dp).clip(CircleShape).background(DetailRaised),
                )
            } else {
                Box(Modifier.size(46.dp).clip(CircleShape).background(DetailRaised), contentAlignment = Alignment.Center) {
                    Text(item.source.name?.take(1)?.uppercase() ?: "C", color = DetailGold, fontWeight = FontWeight.Bold)
                }
            }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(item.source.name ?: "Official source", color = DetailText, fontSize = 15.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(item.source.handle ?: friendlyDetailRoleV055(item.source.role), color = DetailMuted, fontSize = 11.sp, maxLines = 1)
            }
        }

        item.thumbnailUrl?.let { image ->
            AsyncImage(
                model = image,
                contentDescription = item.title,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxWidth().aspectRatio(16f / 9f).clip(RoundedCornerShape(22.dp)).background(DetailRaised),
            )
        }

        Text(item.title, color = DetailText, fontSize = 25.sp, fontWeight = FontWeight.Bold, lineHeight = 31.sp)
        item.text?.takeIf { it.isNotBlank() && it != item.title }?.let {
            Text(it, color = DetailMuted, fontSize = 14.sp, lineHeight = 21.sp)
        }

        Surface(color = DetailGold.copy(alpha = 0.10f), shape = RoundedCornerShape(50)) {
            Text("Official update", color = DetailGold, fontSize = 11.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 12.dp, vertical = 7.dp))
        }

        item.canonicalUrl?.let { url ->
            Button(
                onClick = { runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) } },
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(containerColor = DetailGold, contentColor = Color(0xFF241C09)),
            ) {
                Icon(Icons.Default.OpenInNew, contentDescription = null, modifier = Modifier.size(17.dp))
                Spacer(Modifier.width(8.dp))
                Text("Open original", fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
private fun EventDetailHeaderV055(target: ConsumerDeepLinkTarget.Event) {
    val event = target.event
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Surface(color = DetailGreen.copy(alpha = 0.10f), shape = RoundedCornerShape(50)) {
            Text(
                friendlyVerificationV055(event.verificationState),
                color = DetailGreen,
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(horizontal = 12.dp, vertical = 7.dp),
            )
        }
        event.entityName?.let {
            Text(it, color = DetailGold, fontSize = 13.sp, fontWeight = FontWeight.Bold)
        }
        Text(event.headline, color = DetailText, fontSize = 27.sp, fontWeight = FontWeight.Bold, lineHeight = 33.sp)
        event.summary?.let {
            Text(it, color = DetailMuted, fontSize = 14.sp, lineHeight = 21.sp)
        }
    }
}

@Composable
private fun EventEvidenceCardV055(evidence: ConsumerEvidence) {
    val context = LocalContext.current
    Surface(
        color = DetailPanel,
        shape = RoundedCornerShape(18.dp),
        modifier = Modifier.fillMaxWidth().let { base ->
            val url = evidence.canonicalUrl
            if (url.isNullOrBlank()) base else base.clickable {
                runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) }
            }
        },
    ) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                evidence.source.artworkUrl?.let { image ->
                    AsyncImage(
                        model = image,
                        contentDescription = evidence.source.name,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.size(34.dp).clip(CircleShape).background(DetailRaised),
                    )
                    Spacer(Modifier.width(10.dp))
                }
                Column(Modifier.weight(1f)) {
                    Text(evidence.source.name ?: "Source", color = DetailText, fontSize = 13.sp, fontWeight = FontWeight.Bold, maxLines = 1)
                    Text(friendlyDetailRoleV055(evidence.source.role), color = DetailMuted, fontSize = 10.sp)
                }
                if (!evidence.canonicalUrl.isNullOrBlank()) Icon(Icons.Default.OpenInNew, contentDescription = null, tint = DetailGold, modifier = Modifier.size(16.dp))
            }
            evidence.title?.let { Text(it, color = DetailText, fontSize = 13.sp, lineHeight = 18.sp) }
        }
    }
}

private fun friendlyVerificationV055(value: String?): String = when (value) {
    "OFFICIAL", "CONFIRMED" -> "Official"
    "RELIABLE_REPORT" -> "Reported"
    "DEVELOPING" -> "Developing"
    "RUMOR" -> "Unconfirmed"
    else -> "Update"
}

private fun friendlyDetailRoleV055(role: String?): String = when (role) {
    "PRODUCTION_HOUSE" -> "Movie studio"
    "OTT_PLATFORM" -> "Streaming platform"
    "MUSIC_LABEL" -> "Music channel"
    "FILM_OFFICIAL" -> "Official movie channel"
    "TRADE_MEDIA" -> "Entertainment media"
    else -> "Official source"
}
