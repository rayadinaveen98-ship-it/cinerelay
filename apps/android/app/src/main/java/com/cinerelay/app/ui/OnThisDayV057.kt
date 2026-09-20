package com.cinerelay.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.ChevronLeft
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Today
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import com.cinerelay.app.data.OnThisDayMovie
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle

private val HistoryInk = Color(0xFF0C0E12)
private val HistoryPanel = Color(0xFF171A20)
private val HistoryRaised = Color(0xFF20242C)
private val HistoryText = Color(0xFFF5F2EA)
private val HistoryMuted = Color(0xFFA8ADB7)
private val HistoryGold = Color(0xFFE8C56D)

@Composable
fun OnThisDayV057(
    state: ConsumerUiStateV055,
    onBack: () -> Unit,
    onLoadDate: (String) -> Unit,
    onToday: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val selected = runCatching { LocalDate.parse(state.onThisDayDate) }.getOrNull() ?: LocalDate.now()
    val today = LocalDate.now()
    val grouped = state.onThisDayMovies.groupBy { it.releaseYear }.toSortedMap(compareByDescending { it })

    MaterialTheme(
        colorScheme = darkColorScheme(
            primary = HistoryGold,
            background = HistoryInk,
            surface = HistoryPanel,
            surfaceVariant = HistoryRaised,
            onBackground = HistoryText,
            onSurface = HistoryText,
            onSurfaceVariant = HistoryMuted,
        ),
    ) {
        Surface(modifier = modifier.fillMaxSize(), color = HistoryInk) {
            Column(Modifier.fillMaxSize()) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(start = 8.dp, end = 12.dp, top = 18.dp, bottom = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = HistoryText)
                    }
                    Column(Modifier.weight(1f)) {
                        Text("ON THIS DAY", color = HistoryGold, fontSize = 9.sp, fontWeight = FontWeight.Black, letterSpacing = 1.5.sp)
                        Text("Today in Cinema", color = HistoryText, fontSize = 24.sp, fontWeight = FontWeight.Bold)
                    }
                    TextButton(onClick = onToday) {
                        Icon(Icons.Default.Today, contentDescription = null, tint = HistoryGold, modifier = Modifier.size(17.dp))
                        Spacer(Modifier.width(5.dp))
                        Text("Today", color = HistoryGold, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                }

                Row(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 18.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    IconButton(onClick = { onLoadDate(selected.minusDays(1).toString()) }) {
                        Icon(Icons.Default.ChevronLeft, contentDescription = "Previous day", tint = HistoryText)
                    }
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            selected.format(DateTimeFormatter.ofLocalizedDate(FormatStyle.MEDIUM)),
                            color = HistoryText,
                            fontSize = 17.sp,
                            fontWeight = FontWeight.Bold,
                        )
                        Text("What opened on this date?", color = HistoryMuted, fontSize = 11.sp)
                    }
                    IconButton(
                        onClick = { onLoadDate(selected.plusDays(1).toString()) },
                        enabled = selected < today,
                    ) {
                        Icon(
                            Icons.Default.ChevronRight,
                            contentDescription = "Next day",
                            tint = if (selected < today) HistoryText else HistoryMuted.copy(alpha = 0.35f),
                        )
                    }
                }

                when {
                    state.onThisDayLoading && state.onThisDayMovies.isEmpty() -> {
                        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            CircularProgressIndicator(color = HistoryGold, strokeWidth = 2.dp)
                        }
                    }
                    state.onThisDayMovies.isEmpty() -> {
                        Column(
                            modifier = Modifier.fillMaxSize().padding(horizontal = 28.dp, vertical = 80.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                        ) {
                            Text("No exact-date releases found", color = HistoryText, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                            Spacer(Modifier.height(8.dp))
                            Text(
                                "Our cinema catalog does not have an exact release date for this day yet. Try the previous or next day.",
                                color = HistoryMuted,
                                fontSize = 13.sp,
                                lineHeight = 19.sp,
                            )
                        }
                    }
                    else -> {
                        LazyColumn(
                            contentPadding = PaddingValues(start = 18.dp, end = 18.dp, top = 10.dp, bottom = 36.dp),
                            verticalArrangement = Arrangement.spacedBy(12.dp),
                        ) {
                            grouped.forEach { (year, movies) ->
                                item(key = "year:$year") {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Text(year.toString(), color = HistoryGold, fontSize = 21.sp, fontWeight = FontWeight.Black)
                                        Spacer(Modifier.width(9.dp))
                                        Text(
                                            if (year == selected.year) "This year" else "${selected.year - year} years ago",
                                            color = HistoryMuted,
                                            fontSize = 11.sp,
                                        )
                                    }
                                }
                                items(movies, key = { "history:${it.id}:${it.releaseDate}" }) { movie ->
                                    OnThisDayMovieRowV057(movie)
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
private fun OnThisDayMovieRowV057(movie: OnThisDayMovie) {
    Surface(color = HistoryPanel, shape = RoundedCornerShape(20.dp), modifier = Modifier.fillMaxWidth()) {
        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier.size(width = 76.dp, height = 112.dp).clip(RoundedCornerShape(14.dp)).background(HistoryRaised),
                contentAlignment = Alignment.Center,
            ) {
                val artwork = movie.posterUrl ?: movie.backdropUrl
                if (!artwork.isNullOrBlank()) {
                    AsyncImage(
                        model = artwork,
                        contentDescription = movie.title,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize(),
                    )
                } else {
                    Text(movie.releaseYear.toString(), color = HistoryGold, fontSize = 18.sp, fontWeight = FontWeight.Black)
                }
            }
            Spacer(Modifier.width(14.dp))
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                Text(
                    movie.title,
                    color = HistoryText,
                    fontSize = 16.sp,
                    lineHeight = 21.sp,
                    fontWeight = FontWeight.Bold,
                    maxLines = 3,
                    overflow = TextOverflow.Ellipsis,
                )
                val meta = listOfNotNull(movie.language, movie.countryCode).filter { it.isNotBlank() }.joinToString(" • ")
                if (meta.isNotBlank()) Text(meta, color = HistoryMuted, fontSize = 11.sp)
                Text(
                    if (movie.yearsAgo == 1) "Released 1 year ago today" else "Released ${movie.yearsAgo} years ago today",
                    color = HistoryGold,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold,
                )
            }
        }
    }
}
