package com.cinerelay.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.FilterList
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private val FilterInk = Color(0xFF0D0F13)
private val FilterPanel = Color(0xFF15181E)
private val FilterRaised = Color(0xFF1B1F27)
private val FilterText = Color(0xFFF4F1EA)
private val FilterMuted = Color(0xFFA7ADB7)
private val FilterGold = Color(0xFFE7C36B)
private val FilterGreen = Color(0xFF72D6A4)
private val FilterAmber = Color(0xFFF0B862)
private val FilterOrange = Color(0xFFFF9D63)
private val FilterRed = Color(0xFFF08079)

private val FilterColors = darkColorScheme(
    primary = FilterGold,
    background = FilterInk,
    surface = FilterPanel,
    surfaceVariant = FilterRaised,
    onBackground = FilterText,
    onSurface = FilterText,
    onSurfaceVariant = FilterMuted,
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NewsroomFilterOverlay(
    selected: NewsroomFilter,
    counts: Map<NewsroomFilter, Int>,
    onSelect: (NewsroomFilter) -> Unit,
    modifier: Modifier = Modifier,
) {
    var open by remember { mutableStateOf(false) }

    MaterialTheme(colorScheme = FilterColors) {
        FilledTonalButton(
            onClick = { open = true },
            modifier = modifier,
            shape = RoundedCornerShape(50),
        ) {
            Icon(Icons.Default.FilterList, contentDescription = null, modifier = Modifier.size(17.dp))
            Spacer(Modifier.width(6.dp))
            Text(
                if (selected == NewsroomFilter.ALL) "Filter" else selected.label(),
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
            )
            counts[selected]?.let { count ->
                Spacer(Modifier.width(6.dp))
                Text(count.toString(), color = FilterMuted, fontSize = 10.sp)
            }
        }

        if (open) {
            ModalBottomSheet(
                onDismissRequest = { open = false },
                containerColor = FilterPanel,
                contentColor = FilterText,
            ) {
                Column(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 18.dp).padding(bottom = 28.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Text("NEWSROOM FILTER", color = FilterGold, fontSize = 10.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.2.sp)
                    Text("Show signals by confidence state", color = FilterText, fontSize = 19.sp, fontWeight = FontWeight.Bold)
                    Text(
                        "Filtering changes only what you see. CineRelay keeps ingesting and enriching every accepted newsroom signal in the background.",
                        color = FilterMuted,
                        fontSize = 11.sp,
                        lineHeight = 17.sp,
                        modifier = Modifier.padding(bottom = 7.dp),
                    )

                    NewsroomFilter.entries.forEach { filter ->
                        val selectedRow = filter == selected
                        Surface(
                            color = if (selectedRow) FilterGold.copy(alpha = 0.10f) else FilterRaised,
                            shape = RoundedCornerShape(15.dp),
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    onSelect(filter)
                                    open = false
                                },
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 14.dp, vertical = 13.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                if (filter == NewsroomFilter.ALL) {
                                    Icon(Icons.Default.FilterList, contentDescription = null, tint = FilterGold, modifier = Modifier.size(17.dp))
                                } else {
                                    Box(
                                        Modifier
                                            .size(9.dp)
                                            .clip(CircleShape)
                                            .background(filter.color()),
                                    )
                                }
                                Spacer(Modifier.width(11.dp))
                                Column(Modifier.weight(1f)) {
                                    Text(filter.label(), color = if (selectedRow) FilterGold else FilterText, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                                    if (filter != NewsroomFilter.ALL) {
                                        Text(filter.description(), color = FilterMuted, fontSize = 10.sp)
                                    }
                                }
                                Text((counts[filter] ?: 0).toString(), color = FilterMuted, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }
        }
    }
}

private fun NewsroomFilter.label(): String = when (this) {
    NewsroomFilter.ALL -> "All signals"
    NewsroomFilter.VERIFIED -> "Verified"
    NewsroomFilter.DEVELOPING -> "Developing"
    NewsroomFilter.UNCONFIRMED -> "Unconfirmed"
    NewsroomFilter.CONFLICT_RUMOR -> "Conflict / Rumor"
}

private fun NewsroomFilter.description(): String = when (this) {
    NewsroomFilter.ALL -> ""
    NewsroomFilter.VERIFIED -> "Official or strongly confirmed"
    NewsroomFilter.DEVELOPING -> "Credible and still being enriched"
    NewsroomFilter.UNCONFIRMED -> "Useful signal, not verified enough yet"
    NewsroomFilter.CONFLICT_RUMOR -> "Conflicting claims or explicit rumor"
}

private fun NewsroomFilter.color(): Color = when (this) {
    NewsroomFilter.ALL -> FilterGold
    NewsroomFilter.VERIFIED -> FilterGreen
    NewsroomFilter.DEVELOPING -> FilterAmber
    NewsroomFilter.UNCONFIRMED -> FilterOrange
    NewsroomFilter.CONFLICT_RUMOR -> FilterRed
}
