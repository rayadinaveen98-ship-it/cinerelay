package com.cinerelay.app.ui

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.OpenInNew
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private val CiInk = CineEditorial.Background
private val CiCard = CineEditorial.Surface
private val CiRaised = CineEditorial.Raised
private val CiBorder = CineEditorial.Outline
private val CiWhite = CineEditorial.Text
private val CiSoft = CineEditorial.Muted
private val CiCoral = CineEditorial.Accent
private val CiWarm = CineEditorial.Developing
private val CiGreen = CineEditorial.Confirmed

/** C21 is offline research only: no YouTube API calls or creator monitoring. */
@Composable
fun CreatorIntelligenceBetaV21(onBack: () -> Unit, modifier: Modifier = Modifier) {
    val context = LocalContext.current
    val leads = remember(context) { CreatorResearchV21.load(context) }
    var section by remember { mutableStateOf("Discover") }
    var query by remember { mutableStateOf("") }
    var locale by remember { mutableStateOf("all") }
    var tier by remember { mutableStateOf("all") }
    var expanded by remember { mutableStateOf<String?>(null) }
    val locales = remember(leads) { leads.map { it.locale }.distinct().sorted() }
    val tiers = remember(leads) {
        listOf("NANO_LT10K", "MICRO_10K_100K", "MID_100K_1M",
            "LARGE_1M_10M", "MEGA_10M_PLUS", "UNVERIFIED")
            .filter { t -> leads.any { it.provisionalTier == t } }
    }
    val visible = remember(leads, query, locale, tier) {
        CreatorResearchV21.filter(leads, query, locale, tier)
    }
    Surface(modifier = modifier.fillMaxSize(), color = CiInk) {
        LazyColumn(contentPadding = PaddingValues(bottom = 48.dp), modifier = Modifier.fillMaxSize()) {
            item {
                Row(Modifier.fillMaxWidth().padding(start = 8.dp, top = 7.dp, bottom = 7.dp),
                    verticalAlignment = Alignment.CenterVertically) {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back to CineRelay", tint = CiWhite)
                    }
                    Spacer(Modifier.width(9.dp))
                    Column {
                        Text("CINERELAY / CREATOR LAB", color = CiCoral, fontSize = 10.sp,
                            letterSpacing = 1.6.sp, fontWeight = FontWeight.Bold)
                        Text("Creator Intelligence", color = CiWhite, fontSize = 21.sp,
                            fontWeight = FontWeight.SemiBold)
                    }
                }
            }
            item {
                Column(
                    Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp)
                        .background(Brush.linearGradient(listOf(
                            Color(0xFF34212A), Color(0xFF1B1922))), RoundedCornerShape(20.dp))
                        .padding(20.dp),
                ) {
                    Text("DISCOVERY BETA", color = CiCoral, fontSize = 11.sp,
                        letterSpacing = 1.7.sp, fontWeight = FontWeight.Bold)
                    Spacer(Modifier.height(10.dp))
                    Text("Find creators.\nExplore the landscape.", color = CiWhite,
                        fontSize = 25.sp, lineHeight = 30.sp, fontWeight = FontWeight.SemiBold)
                    Spacer(Modifier.height(10.dp))
                    Text("Provisional research across regions, formats and creator sizes. " +
                        "No official channel verification or performance data.",
                        color = CiSoft, fontSize = 13.sp, lineHeight = 19.sp)
                    Spacer(Modifier.height(15.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        CiStat(leads.size.toString(), "Leads")
                        CiStat(locales.size.toString(), "Languages")
                        CiStat("OFF", "Monitoring")
                    }
                }
            }
            item {
                Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
                    horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                    listOf("Discover", "Verified").forEach { name ->
                        Box(Modifier.weight(1f)
                            .background(if (section == name) CiCoral else CiRaised,
                                RoundedCornerShape(12.dp))
                            .clickable { section = name },
                            contentAlignment = Alignment.Center) {
                            Text(name, modifier = Modifier.padding(vertical = 12.dp),
                                color = if (section == name) CiInk else CiSoft,
                                fontWeight = FontWeight.SemiBold)
                        }
                    }
                }
            }
            if (section == "Verified") {
                item {
                    CreatorVerifiedPanelV22(
                        leads = leads,
                        onDiscover = { section = "Discover" },
                    )
                }
            } else {
                item {
                    OutlinedTextField(value = query, onValueChange = { query = it },
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
                        placeholder = { Text("Search creator, handle or niche") },
                        leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                        singleLine = true, shape = RoundedCornerShape(12.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = CiWhite, unfocusedTextColor = CiWhite,
                            focusedBorderColor = CiCoral, unfocusedBorderColor = CiBorder,
                            focusedContainerColor = CiCard, unfocusedContainerColor = CiCard,
                        ))
                }
                item {
                    Text("LANGUAGE / REGION",
                        modifier = Modifier.padding(start = 18.dp, top = 20.dp, bottom = 3.dp),
                        color = CiSoft, fontSize = 11.sp, letterSpacing = 1.2.sp)
                    LazyRow(contentPadding = PaddingValues(horizontal = 16.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        items(listOf("all") + locales) { value ->
                            CiChip(
                                if (value == "all") "All regions" else CreatorResearchV21.localeLabel(value),
                                selected = value == locale,
                                onClick = { locale = value; expanded = null },
                            )
                        }
                    }
                }
                item {
                    Text("PROVISIONAL SIZE",
                        modifier = Modifier.padding(start = 18.dp, top = 13.dp, bottom = 3.dp),
                        color = CiSoft, fontSize = 11.sp, letterSpacing = 1.2.sp)
                    LazyRow(contentPadding = PaddingValues(horizontal = 16.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        items(listOf("all") + tiers) { value ->
                            CiChip(
                                if (value == "all") "All sizes" else CreatorResearchV21.tierLabel(value),
                                selected = value == tier,
                                onClick = { tier = value; expanded = null },
                            )
                        }
                    }
                }
                item {
                    Row(Modifier.fillMaxWidth().padding(start = 18.dp, end = 18.dp,
                        top = 19.dp, bottom = 10.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically) {
                        Text("Research leads", color = CiWhite, fontSize = 18.sp,
                            fontWeight = FontWeight.SemiBold)
                        Text(visible.size.toString() + " / " + leads.size.toString(),
                            color = CiSoft, fontSize = 12.sp)
                    }
                }
                if (leads.isEmpty()) {
                    item {
                        Text("Research data unavailable. No creators will be invented.",
                            modifier = Modifier.padding(22.dp), color = CiWarm)
                    }
                } else if (visible.isEmpty()) {
                    item {
                        Column(Modifier.padding(20.dp)) {
                            Text("No matching creators", color = CiWhite, fontSize = 17.sp)
                            Text("Try another language or size filter.", color = CiSoft)
                            TextButton(onClick = { query = ""; locale = "all"; tier = "all" }) {
                                Text("Clear filters", color = CiCoral)
                            }
                        }
                    }
                }
                items(visible, key = { it.id }) { item ->
                    CiLeadCard(
                        lead = item, expanded = expanded == item.id,
                        onClick = { expanded = if (expanded == item.id) null else item.id },
                        onSource = {
                            runCatching {
                                val uri = Uri.parse(item.sourceUrl)
                                if (uri.scheme == "https") {
                                    context.startActivity(Intent(Intent.ACTION_VIEW, uri))
                                }
                            }
                        },
                    )
                }
                item {
                    Text("Research snapshot · 27 Oct 2026\n" +
                        "Handles and size tiers are provisional. No YouTube API verification, " +
                        "subscriber tracking or derived metrics.",
                        modifier = Modifier.padding(horizontal = 20.dp, vertical = 20.dp),
                        color = CiSoft, fontSize = 11.sp, lineHeight = 17.sp)
                }
            }
        }
    }
}
@Composable
private fun CiStat(value: String, label: String) {
    Column(Modifier.background(Color.White.copy(alpha = 0.06f),
        RoundedCornerShape(10.dp)).padding(horizontal = 11.dp, vertical = 9.dp)) {
        Text(value, color = CiWhite, fontWeight = FontWeight.Bold, fontSize = 18.sp)
        Text(label, color = CiSoft, fontSize = 10.sp)
    }
}
@Composable
private fun CiChip(title: String, selected: Boolean, onClick: () -> Unit) {
    FilterChip(selected = selected, onClick = onClick,
        label = { Text(title, fontSize = 12.sp) },
        shape = RoundedCornerShape(10.dp),
        colors = FilterChipDefaults.filterChipColors(
            containerColor = CiCard, labelColor = CiSoft,
            selectedContainerColor = CiCoral.copy(alpha = 0.17f),
            selectedLabelColor = CiWhite,
        ))
}
@Composable
private fun CiLeadCard(
    lead: CreatorResearchLeadV21,
    expanded: Boolean,
    onClick: () -> Unit,
    onSource: () -> Unit,
) {
    Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 5.dp)
        .background(CiCard, RoundedCornerShape(14.dp))
        .clickable(onClick = onClick).padding(15.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(42.dp).background(Color(0xFF39262F), CircleShape),
                contentAlignment = Alignment.Center) {
                Text(lead.name.trim().take(1).uppercase(), color = CiCoral,
                    fontSize = 18.sp, fontWeight = FontWeight.Bold)
            }
            Spacer(Modifier.width(11.dp))
            Column(Modifier.weight(1f)) {
                Text(lead.name, color = CiWhite, fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold, maxLines = 2,
                    overflow = TextOverflow.Ellipsis)
                Text(CreatorResearchV21.localeLabel(lead.locale) + " · " + lead.category,
                    color = CiSoft, fontSize = 11.sp, maxLines = 2,
                    overflow = TextOverflow.Ellipsis)
            }
            Icon(Icons.Default.ChevronRight, contentDescription = "View source",
                tint = CiSoft)
        }
        Spacer(Modifier.height(8.dp))
        Text("RESEARCH ONLY   ·   " + CreatorResearchV21.tierLabel(lead.provisionalTier),
            color = CiWarm, fontSize = 10.sp)
        if (expanded) {
            Spacer(Modifier.height(13.dp))
            HorizontalDivider(color = CiBorder)
            Spacer(Modifier.height(12.dp))
            Text("Discovered handle", color = CiSoft, fontSize = 11.sp)
            Text(lead.handle ?: "Not established in source", color = CiWhite,
                fontSize = 13.sp)
            Spacer(Modifier.height(10.dp))
            Text("This discovery entry is not YouTube API-verified. The size tier " +
                "is a research label, not a live subscriber count.",
                color = CiSoft, fontSize = 12.sp, lineHeight = 18.sp)
            TextButton(onClick = onSource) {
                Icon(Icons.Default.OpenInNew, contentDescription = null,
                    tint = CiCoral, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(7.dp))
                Text("View discovery source", color = CiCoral, fontSize = 13.sp)
            }
        }
    }
}
