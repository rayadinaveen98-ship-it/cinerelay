package com.cinerelay.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.cinerelay.app.CineRelayApplication
import com.cinerelay.app.data.ApiException
import com.cinerelay.app.data.CreatorVerifiedIdentityV22
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.time.Instant
import java.time.format.DateTimeFormatter
import java.time.ZoneId
import java.util.Locale

private sealed interface VerifiedLoadingV22 {
    data object Loading : VerifiedLoadingV22
    data class Loaded(val records: List<CreatorVerifiedIdentityV22>) : VerifiedLoadingV22
    data class Blocked(val reason: String) : VerifiedLoadingV22
}

/** Never caches API identities to disk or across sign-outs. */
@Composable
internal fun CreatorVerifiedPanelV22(
    leads: List<CreatorResearchLeadV21>,
    onDiscover: () -> Unit,
) {
    val context = LocalContext.current
    val app = context.applicationContext as CineRelayApplication
    var attempt by remember { mutableIntStateOf(0) }
    var result by remember { mutableStateOf<VerifiedLoadingV22>(VerifiedLoadingV22.Loading) }

    LaunchedEffect(attempt) {
        result = VerifiedLoadingV22.Loading
        result = withContext(Dispatchers.IO) {
            try {
                VerifiedLoadingV22.Loaded(app.backendClient.verifiedCreatorIdentities())
            } catch (error: ApiException) {
                val reason = when (error.statusCode) {
                    401, 403 -> "Verified identities are private to approved CineRelay operators. " +
                        "You can continue exploring research leads below."
                    404, 503 -> "Fresh identity storage is not available on the hosted backend yet. " +
                        "The app will not substitute historical YouTube API records."
                    else -> "The secure identity check is unavailable. " +
                        "No old channel IDs or metrics are being shown."
                }
                VerifiedLoadingV22.Blocked(reason)
            } catch (_: Exception) {
                VerifiedLoadingV22.Blocked(
                    "Could not reach the protected verification service. " +
                        "Research remains available offline.",
                )
            }
        }
    }

    Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp)
        .background(CineEditorial.Surface, RoundedCornerShape(18.dp))
        .padding(20.dp)) {
        Text("IDENTITY REVIEW", color = CineEditorial.Accent, fontSize = 11.sp,
            fontWeight = FontWeight.Bold, letterSpacing = 1.3.sp)
        Spacer(Modifier.height(7.dp))
        when (val current = result) {
            VerifiedLoadingV22.Loading -> {
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    CircularProgressIndicator(color = CineEditorial.Accent)
                    Text("Checking fresh, protected records…",
                        color = CineEditorial.Text, fontSize = 13.sp)
                }
            }
            is VerifiedLoadingV22.Blocked -> {
                Text("Fresh identities unavailable", color = CineEditorial.Text,
                    fontSize = 20.sp, fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.height(9.dp))
                Text(current.reason, color = CineEditorial.Muted,
                    fontSize = 13.sp, lineHeight = 20.sp)
            }
            is VerifiedLoadingV22.Loaded -> {
                // Avoid showing previously loaded rows once their 28-day evidence expires.
                val records = current.records.filter {
                    runCatching { Instant.parse(it.expiresAt).isAfter(Instant.now()) }
                        .getOrDefault(false)
                }
                Text(
                    if (records.isEmpty()) "0 current official identities"
                    else records.size.toString() + " fresh identity records",
                    color = CineEditorial.Text, fontSize = 21.sp,
                    fontWeight = FontWeight.SemiBold,
                )
                Spacer(Modifier.height(8.dp))
                Text(
                    if (records.isEmpty())
                        "The secure review service currently has no unexpired official IDs."
                    else
                        "Official YouTube identity confirmed · editorial approval still pending",
                    color = CineEditorial.Muted, fontSize = 13.sp, lineHeight = 20.sp,
                )
                for (identity in records) {
                    Spacer(Modifier.height(12.dp))
                    HorizontalDivider(color = CineEditorial.Outline)
                    Spacer(Modifier.height(12.dp))
                    Text(identity.officialTitle, color = CineEditorial.Text,
                        fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
                    Text(identity.listedHandle + " · " +
                        CreatorResearchV21.localeLabel(identity.language),
                        color = CineEditorial.Muted, fontSize = 12.sp)
                    Text("UC identity verified · REVIEW PENDING",
                        color = CineEditorial.Confirmed, fontSize = 11.sp)
                    val expires = runCatching {
                        DateTimeFormatter.ofPattern("dd MMM yyyy", Locale.ENGLISH)
                            .withZone(ZoneId.of("Asia/Kolkata"))
                            .format(Instant.parse(identity.expiresAt))
                    }.getOrDefault("unavailable")
                    Text("Evidence expires " + expires,
                        color = CineEditorial.Muted, fontSize = 11.sp)
                }
            }
        }
        Spacer(Modifier.height(13.dp))
        Text("MONITORING OFF   ·   METRICS OFF   ·   COMPARISONS OFF",
            color = CineEditorial.Developing, fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold)
        TextButton(onClick = { attempt += 1 }) {
            Text("Check again", color = CineEditorial.Accent)
        }
    }

    Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp)
        .background(CineEditorial.Surface, RoundedCornerShape(18.dp))
        .padding(20.dp)) {
        Text("UNVERIFIED RESEARCH", color = CineEditorial.Developing,
            fontSize = 11.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.3.sp)
        Spacer(Modifier.height(8.dp))
        Text(leads.size.toString() + " discovery leads to research",
            color = CineEditorial.Text, fontSize = 19.sp,
            fontWeight = FontWeight.SemiBold)
        Spacer(Modifier.height(7.dp))
        Text("These are NOT verified channels or an approved monitoring queue. " +
            "Research leads must be checked and reviewed individually.",
            color = CineEditorial.Muted, fontSize = 13.sp, lineHeight = 20.sp)
        val preview = leads.groupBy { it.locale }.values.mapNotNull { it.firstOrNull() }.take(6)
        preview.forEach { lead ->
            Spacer(Modifier.height(10.dp))
            HorizontalDivider(color = CineEditorial.Outline)
            Spacer(Modifier.height(10.dp))
            Text(lead.name, color = CineEditorial.Text, fontWeight = FontWeight.SemiBold,
                fontSize = 13.sp)
            Text(CreatorResearchV21.localeLabel(lead.locale) + " · Research only",
                color = CineEditorial.Muted, fontSize = 11.sp)
        }
        Spacer(Modifier.height(9.dp))
        TextButton(onClick = onDiscover) {
            Text("Browse all research leads", color = CineEditorial.Accent)
        }
    }
}
