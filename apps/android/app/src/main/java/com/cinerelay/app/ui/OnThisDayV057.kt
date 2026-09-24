package com.cinerelay.app.ui

import androidx.compose.foundation.background
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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
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
import androidx.compose.ui.graphics.Brush
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
import java.util.Locale

private val HistoryInk = Color(0xFF0C0E12)
private val HistoryPanel = Color(0xFF171A20)
private val HistoryRaised = Color(0xFF20242C)
private val HistoryText = Color(0xFFF5F2EA)
private val HistoryMuted = Color(0xFFA8ADB7)
private val HistoryGold = Color(0xFFE8C56D)
private val HistoryGreen = Color(0xFF73D6A5)

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
    val earliestYear = state.onThisDayMovies.minOfOrNull { it.releaseYear }
    val latestYear = state.onThisDayMovies.maxOfOrNull { it.releaseYear }

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
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(bottom = 118.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                item {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(start = 8.dp, end = 12.dp, top = 18.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        IconButton(onClick = onBack) {
                            Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = HistoryText)
                        }
                        Column(Modifier.weight(1f)) {
                            Text("CINEMA TIME MACHINE", color = HistoryGold, fontSize = 9.sp, fontWeight = FontWeight.Black, letterSpacing = 1.5.sp)
                            Text("Today in Cinema", color = HistoryText, fontSize = 24.sp, fontWeight = FontWeight.Bold)
                        }
                        TextButton(onClick = onToday) {
                            Icon(Icons.Default.Today, contentDescription = null, tint = HistoryGold, modifier = Modifier.size(17.dp))
                            Spacer(Modifier.width(5.dp))
                            Text("Today", color = HistoryGold, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }

                item {
                    HistoryDateHeroV060(
                        selected = selected,
                        today = today,
                        movieCount = state.onThisDayMovies.size,
                        earliestYear = earliestYear,
                        latestYear = latestYear,
                        onPrevious = { onLoadDate(selected.minusDays(1).toString()) },
                        onNext = { onLoadDate(selected.plusDays(1).toString()) },
                    )
                }

                item {
                    HistoryQuickJumpV060(selected = selected, today = today, onLoadDate = onLoadDate, onToday = onToday)
                }

                when {
                    state.onThisDayLoading && state.onThisDayMovies.isEmpty() -> {
                        item {
                            Box(Modifier.fillMaxWidth().height(220.dp), contentAlignment = Alignment.Center) {
                                CircularProgressIndicator(color = HistoryGold, strokeWidth = 2.dp)
                            }
                        }
                    }

                    state.onThisDayMovies.isEmpty() -> {
                        item {
                            Surface(
                                color = HistoryPanel,
                                shape = RoundedCornerShape(24.dp),
                                modifier = Modifier.fillMaxWidth().padding(horizontal = 18.dp),
                            ) {
                                Column(
                                    modifier = Modifier.padding(horizontal = 22.dp, vertical = 30.dp),
                                    horizontalAlignment = Alignment.CenterHorizontally,
                                ) {
                                    Box(Modifier.size(9.dp).clip(CircleShape).background(HistoryGold))
                                    Spacer(Modifier.height(12.dp))
                                    Text("No exact-date releases found", color = HistoryText, fontSize = 19.sp, fontWeight = FontWeight.Bold)
                                    Spacer(Modifier.height(7.dp))
                                    Text(
                                        "Our catalog does not have a verified exact release date for this day yet. Use the quick jumps or explore the day before.",
                                        color = HistoryMuted,
                                        fontSize = 12.sp,
                                        lineHeight = 18.sp,
                                    )
                                }
                            }
                        }
                    }

                    else -> {
                        grouped.forEach { (year, movies) ->
                            item(key = "year:$year") {
                                HistoryYearHeaderV060(year = year, selectedYear = selected.year, count = movies.size)
                            }
                            items(movies, key = { "history:${it.id}:${it.releaseDate}" }) { movie ->
                                OnThisDayMovieRowV070(movie, modifier = Modifier.padding(horizontal = 18.dp))
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun HistoryDateHeroV060(
    selected: LocalDate,
    today: LocalDate,
    movieCount: Int,
    earliestYear: Int?,
    latestYear: Int?,
    onPrevious: () -> Unit,
    onNext: () -> Unit,
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 18.dp)
            .clip(RoundedCornerShape(28.dp))
            .background(
                Brush.linearGradient(
                    listOf(
                        HistoryGold.copy(alpha = 0.22f),
                        HistoryPanel,
                        HistoryRaised.copy(alpha = 0.92f),
                    ),
                ),
            ),
    ) {
        Column(Modifier.fillMaxWidth().padding(18.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onPrevious) {
                    Icon(Icons.Default.ChevronLeft, contentDescription = "Previous day", tint = HistoryText)
                }
                Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        selected.format(DateTimeFormatter.ofPattern("dd", Locale.ENGLISH)),
                        color = HistoryGold,
                        fontSize = 38.sp,
                        fontWeight = FontWeight.Black,
                    )
                    Text(
                        selected.format(DateTimeFormatter.ofPattern("MMMM", Locale.ENGLISH)).uppercase(Locale.ENGLISH),
                        color = HistoryText,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Black,
                        letterSpacing = 1.5.sp,
                    )
                    Text(
                        selected.format(DateTimeFormatter.ofLocalizedDate(FormatStyle.FULL)),
                        color = HistoryMuted,
                        fontSize = 10.sp,
                    )
                }
                IconButton(onClick = onNext, enabled = selected < today) {
                    Icon(
                        Icons.Default.ChevronRight,
                        contentDescription = "Next day",
                        tint = if (selected < today) HistoryText else HistoryMuted.copy(alpha = 0.28f),
                    )
                }
            }

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                HistoryStatV060("Releases", movieCount.toString(), Modifier.weight(1f))
                HistoryStatV060("Years", earliestYear?.let { earliest -> latestYear?.let { latest -> (latest - earliest + 1).coerceAtLeast(1).toString() } } ?: "—", Modifier.weight(1f))
                HistoryStatV060("Oldest", earliestYear?.toString() ?: "—", Modifier.weight(1f))
            }
        }
    }
}

@Composable
private fun HistoryStatV060(label: String, value: String, modifier: Modifier = Modifier) {
    Surface(color = HistoryInk.copy(alpha = 0.52f), shape = RoundedCornerShape(16.dp), modifier = modifier) {
        Column(Modifier.padding(vertical = 9.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Text(value, color = HistoryText, fontSize = 15.sp, fontWeight = FontWeight.Black)
            Text(label, color = HistoryMuted, fontSize = 8.sp, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun HistoryQuickJumpV060(
    selected: LocalDate,
    today: LocalDate,
    onLoadDate: (String) -> Unit,
    onToday: () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(7.dp)) {
        Text(
            "QUICK JUMP",
            color = HistoryMuted,
            fontSize = 8.sp,
            fontWeight = FontWeight.Black,
            letterSpacing = 1.2.sp,
            modifier = Modifier.padding(horizontal = 20.dp),
        )
        LazyRow(
            contentPadding = PaddingValues(horizontal = 18.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            item { HistoryJumpChipV060("Yesterday", selected == today.minusDays(1)) { onLoadDate(today.minusDays(1).toString()) } }
            item { HistoryJumpChipV060("7 days back", selected == today.minusDays(7)) { onLoadDate(today.minusDays(7).toString()) } }
            item { HistoryJumpChipV060("30 days back", selected == today.minusDays(30)) { onLoadDate(today.minusDays(30).toString()) } }
            item { HistoryJumpChipV060("Today", selected == today, onToday) }
        }
    }
}

@Composable
private fun HistoryJumpChipV060(label: String, selected: Boolean, onClick: () -> Unit) {
    Surface(
        color = if (selected) HistoryGold.copy(alpha = 0.16f) else HistoryPanel,
        contentColor = if (selected) HistoryGold else HistoryMuted,
        shape = RoundedCornerShape(50),
        modifier = Modifier.clickable(onClick = onClick),
    ) {
        Text(label, fontSize = 10.sp, fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium, modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp))
    }
}

@Composable
private fun HistoryYearHeaderV060(year: Int, selectedYear: Int, count: Int) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 2.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(year.toString(), color = HistoryGold, fontSize = 22.sp, fontWeight = FontWeight.Black)
        Spacer(Modifier.width(9.dp))
        Column(Modifier.weight(1f)) {
            Text(if (year == selectedYear) "This year" else "${selectedYear - year} years ago", color = HistoryText, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
            Text("$count release${if (count == 1) "" else "s"} on this date", color = HistoryMuted, fontSize = 9.sp)
        }
        Box(Modifier.size(7.dp).clip(CircleShape).background(HistoryGreen))
    }
}

@Composable
private fun OnThisDayMovieRowV070(movie: OnThisDayMovie, modifier: Modifier = Modifier) {
    Surface(color = HistoryPanel, shape = RoundedCornerShape(22.dp), modifier = modifier.fillMaxWidth()) {
        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier.size(width = 82.dp, height = 118.dp).clip(RoundedCornerShape(16.dp)).background(HistoryRaised),
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
                    Box(
                        Modifier.fillMaxSize().background(
                            Brush.verticalGradient(listOf(Color.Transparent, Color.Transparent, HistoryInk.copy(alpha = 0.64f))),
                        ),
                    )
                } else {
                    Text(movie.releaseYear.toString(), color = HistoryGold, fontSize = 18.sp, fontWeight = FontWeight.Black)
                }
                Surface(
                    color = HistoryInk.copy(alpha = 0.84f),
                    shape = RoundedCornerShape(50),
                    modifier = Modifier.align(Alignment.BottomStart).padding(7.dp),
                ) {
                    Text(movie.releaseYear.toString(), color = HistoryGold, fontSize = 8.sp, fontWeight = FontWeight.Black, modifier = Modifier.padding(horizontal = 7.dp, vertical = 4.dp))
                }
            }
            Spacer(Modifier.width(14.dp))
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(
                    movie.title,
                    color = HistoryText,
                    fontSize = 17.sp,
                    lineHeight = 21.sp,
                    fontWeight = FontWeight.Bold,
                    maxLines = 3,
                    overflow = TextOverflow.Ellipsis,
                )
                movie.nativeTitle
                    ?.takeIf { it.isNotBlank() && !it.equals(movie.title, ignoreCase = true) }
                    ?.let { nativeTitle ->
                        Text(
                            nativeTitle,
                            color = HistoryMuted,
                            fontSize = 10.sp,
                            lineHeight = 14.sp,
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                val meta = listOfNotNull(movie.language, movie.countryCode).filter { it.isNotBlank() }.joinToString(" • ")
                if (meta.isNotBlank()) Text(meta, color = HistoryMuted, fontSize = 10.sp)
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                    Surface(color = HistoryGold.copy(alpha = 0.10f), shape = RoundedCornerShape(50)) {
                        Text(
                            if (movie.yearsAgo == 1) "1 year ago today" else "${movie.yearsAgo} years ago today",
                            color = HistoryGold,
                            fontSize = 9.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(horizontal = 9.dp, vertical = 5.dp),
                        )
                    }
                    movie.verificationStatus?.takeIf { it.isNotBlank() }?.let { status ->
                        val verified = status.uppercase(Locale.ENGLISH) in setOf("VERIFIED", "CONFIRMED", "OFFICIAL")
                        Surface(
                            color = (if (verified) HistoryGreen else HistoryMuted).copy(alpha = 0.10f),
                            shape = RoundedCornerShape(50),
                        ) {
                            Text(
                                historyVerificationLabelV070(status),
                                color = if (verified) HistoryGreen else HistoryMuted,
                                fontSize = 8.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 5.dp),
                            )
                        }
                    }
                }
            }
        }
    }
}

private fun historyVerificationLabelV070(value: String): String = value
    .lowercase(Locale.ENGLISH)
    .split('_')
    .filter { it.isNotBlank() }
    .joinToString(" ") { token -> token.replaceFirstChar { it.titlecase(Locale.ENGLISH) } }
