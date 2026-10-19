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
import androidx.compose.foundation.lazy.rememberLazyListState
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
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.activity.compose.BackHandler
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

private val HistoryInk = CineEditorial.Background
private val HistoryPanel = CineEditorial.Surface
private val HistoryRaised = CineEditorial.Raised
private val HistoryText = CineEditorial.Text
private val HistoryMuted = CineEditorial.Muted
private val HistoryGold = CineEditorial.Accent
private val HistoryGreen = CineEditorial.Confirmed

@Composable
fun OnThisDayV057(
    state: ConsumerUiStateV055,
    onBack: () -> Unit,
    onLoadDate: (String) -> Unit,
    onToday: () -> Unit,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val landingListState=rememberLazyListState()
    var openedYear by rememberSaveable { mutableStateOf<Int?>(null) }
    var openedMovieId by rememberSaveable { mutableStateOf<String?>(null) }
    LaunchedEffect(state.onThisDayDate) { openedYear=null; openedMovieId=null }
    BackHandler(enabled=openedYear!=null||openedMovieId!=null){
        if(openedMovieId!=null) openedMovieId=null else openedYear=null
    }
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
            val chosenMovie=state.onThisDayMovies.firstOrNull{it.id==openedMovieId}
            val chosenYear=openedYear
            if(chosenMovie!=null || chosenYear!=null){
                LazyColumn(Modifier.fillMaxSize(),contentPadding=PaddingValues(bottom=128.dp),
                    verticalArrangement=Arrangement.spacedBy(12.dp)){
                    if(chosenMovie!=null){
                        item{DiscoverySubpageHeaderV080(chosenMovie.title,
                            chosenMovie.releaseDate+" · "+chosenMovie.releaseYear,
                            onBack={openedMovieId=null})}
                        item{OnThisDayMovieRowV070(chosenMovie,Modifier.padding(horizontal=16.dp))}
                    }else if(chosenYear!=null){
                        val movies=grouped[chosenYear].orEmpty()
                        item{DiscoverySubpageHeaderV080(chosenYear.toString(),
                            movies.size.toString()+" releases on "+selected.dayOfMonth+" "+selected.month.name.lowercase().replaceFirstChar{it.uppercase()},
                            onBack={openedYear=null})}
                        items(movies,key={it.id}){movie->
                            Box(Modifier.clickable{openedMovieId=movie.id}){
                                OnThisDayMovieRowV070(movie,Modifier.padding(horizontal=16.dp))
                            }
                        }
                    }
                }
            }else LazyColumn(
                state=landingListState,
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(bottom = 118.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                item {
                    EditorialMastheadV2(
                        section = "CINEMA / TIME MACHINE",
                        title = "On this day.",
                        subtitle = "A date-led journey through memorable releases, organized by year.",
                        modifier = Modifier.padding(horizontal = CineEditorial.Gutter),
                        actions = {
                            IconButton(onClick = onBack) {
                                Icon(Icons.Default.ArrowBack,
                                    contentDescription = "Back", tint = HistoryText)
                            }
                            TextButton(onClick = onToday) {
                                Text("Today", color = HistoryGold, fontSize = 12.sp)
                            }
                        },
                    )
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

                    state.onThisDayError != null -> {
                        item {
                            Surface(
                                color = HistoryPanel,
                                shape = RoundedCornerShape(20.dp),
                                modifier = Modifier.fillMaxWidth()
                                    .padding(horizontal = CineEditorial.Gutter),
                            ) {
                                Column(
                                    modifier = Modifier.padding(22.dp),
                                    verticalArrangement = Arrangement.spacedBy(12.dp),
                                ) {
                                    EditorialEyebrowV2("HISTORY SERVICE / UNAVAILABLE")
                                    EditorialDisplayV2(
                                        "History is temporarily unavailable.",
                                        size = 23, lines = 3,
                                    )
                                    Text(
                                        state.onThisDayError,
                                        color = HistoryMuted, fontSize = 13.sp,
                                        lineHeight = 19.sp,
                                    )
                                    TextButton(onClick = onRetry) {
                                        Text("Try again  →", color = HistoryGold,
                                            fontSize = 14.sp, fontWeight = FontWeight.Bold)
                                    }
                                    Text(
                                        "No films have been removed. You can still use Home, OTT and Radar.",
                                        color = HistoryMuted, fontSize = 12.sp,
                                        lineHeight = 17.sp,
                                    )
                                }
                            }
                        }
                    }

                    state.onThisDayMovies.isEmpty() -> {
                        item {
                            Surface(
                                color = HistoryPanel,
                                shape = RoundedCornerShape(20.dp),
                                modifier = Modifier.fillMaxWidth().padding(horizontal = CineEditorial.Gutter),
                            ) {
                                Column(
                                    modifier = Modifier.padding(horizontal = CineEditorial.Gutter, vertical = 30.dp),
                                    horizontalAlignment = Alignment.CenterHorizontally,
                                ) {
                                    Box(Modifier.size(9.dp).clip(CircleShape).background(HistoryGold))
                                    Spacer(Modifier.height(12.dp))
                                    Text("Nothing found for this date yet", color = HistoryText, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                                    Spacer(Modifier.height(7.dp))
                                    Text(
                                        "We don’t have a confirmed release for this date yet. Try another day or use the quick jumps.",
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
                            item(key="year:$year"){
                                EditorialSectionV2(
                                    label = "THROUGH THE YEARS / ${movies.size} RELEASES",
                                    title = year.toString(),
                                    modifier = Modifier.padding(horizontal = CineEditorial.Gutter),
                                    trailing = {
                                        TextButton(onClick = { openedYear = year }) {
                                            Text("See all →", color = HistoryGold, fontSize = 12.sp)
                                        }
                                    },
                                )
                            }
                            item(key="year-rail:$year"){
                                LazyRow(contentPadding=PaddingValues(horizontal=16.dp),
                                    horizontalArrangement=Arrangement.spacedBy(12.dp)){
                                    items(movies.take(12),key={it.id}){movie->
                                        HistoryPreviewCardV080(movie){openedMovieId=movie.id}
                                    }
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
private fun HistoryPreviewCardV080(movie: OnThisDayMovie, onClick: () -> Unit) {
    Column(
        modifier = Modifier.width(144.dp).clickable(onClick = onClick),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        EditorialArtworkV2(
            url = movie.posterUrl ?: movie.backdropUrl,
            title = movie.title,
            modifier = Modifier.fillMaxWidth().height(152.dp),
            label = movie.releaseYear.toString(),
        )
        EditorialDisplayV2(movie.title, size = 17, lines = 2)
        Text(listOfNotNull(movie.language, movie.countryCode).joinToString(" · "),
            color = HistoryMuted, fontSize = 12.sp,
            maxLines = 1, overflow = TextOverflow.Ellipsis)
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
    Surface(
        color = HistoryRaised,
        shape = RoundedCornerShape(22.dp),
        modifier = Modifier.fillMaxWidth().padding(horizontal = CineEditorial.Gutter),
    ) {
        Column(Modifier.padding(19.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            EditorialEyebrowV2(
                selected.format(DateTimeFormatter.ofPattern("EEEE / MMMM", Locale.ENGLISH)),
            )
            Row(verticalAlignment = Alignment.CenterVertically) {
                EditorialDisplayV2(
                    selected.format(DateTimeFormatter.ofPattern("dd", Locale.ENGLISH)),
                    modifier = Modifier.weight(1f), size = 68, lines = 1,
                )
                Column(verticalArrangement = Arrangement.spacedBy(5.dp),
                    horizontalAlignment = Alignment.End) {
                    Text("${movieCount} releases", color = HistoryText,
                        fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                    Text(
                        if (earliestYear != null && latestYear != null)
                            "Across ${earliestYear}–${latestYear}" else "On this date",
                        color = HistoryMuted, fontSize = 12.sp,
                    )
                }
            }
            androidx.compose.material3.HorizontalDivider(color = CineEditorial.Outline)
            Row(verticalAlignment = Alignment.CenterVertically) {
                TextButton(onClick = onPrevious, modifier = Modifier.weight(1f)) {
                    Icon(Icons.Default.ChevronLeft, contentDescription = null, tint = HistoryText)
                    Text("Previous day", color = HistoryText, fontSize = 12.sp)
                }
                TextButton(onClick = onNext, enabled = selected < today,
                    modifier = Modifier.weight(1f)) {
                    Text("Next day", color = if (selected < today) HistoryText else HistoryMuted,
                        fontSize = 12.sp)
                    Icon(Icons.Default.ChevronRight,
                        contentDescription = null,
                        tint = if (selected < today) HistoryText else HistoryMuted)
                }
            }
        }
    }
}

@Composable
private fun HistoryStatV060(label: String, value: String, modifier: Modifier = Modifier) {
    Surface(color = HistoryInk.copy(alpha = 0.52f), shape = RoundedCornerShape(16.dp), modifier = modifier) {
        Column(Modifier.padding(vertical = 9.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Text(value, color = HistoryText, fontSize = 16.sp, fontWeight = FontWeight.Black)
            Text(label, color = HistoryMuted, fontSize = 12.sp, fontWeight = FontWeight.Bold)
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
            fontSize = 12.sp,
            fontWeight = FontWeight.Black,
            letterSpacing = 1.2.sp,
            modifier = Modifier.padding(horizontal = CineEditorial.Gutter),
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
        Text(label, fontSize = 12.sp, fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium, modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp))
    }
}

@Composable
private fun HistoryYearHeaderV060(year: Int, selectedYear: Int, count: Int) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = CineEditorial.Gutter, vertical = 2.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(year.toString(), color = HistoryGold, fontSize = 20.sp, fontWeight = FontWeight.Black)
        Spacer(Modifier.width(9.dp))
        Column(Modifier.weight(1f)) {
            Text(if (year == selectedYear) "This year" else "${selectedYear - year} years ago", color = HistoryText, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
            Text("$count release${if (count == 1) "" else "s"} on this date", color = HistoryMuted, fontSize = 12.sp)
        }
        Box(Modifier.size(7.dp).clip(CircleShape).background(HistoryGreen))
    }
}

@Composable
private fun OnThisDayMovieRowV070(movie: OnThisDayMovie, modifier: Modifier = Modifier) {
    Surface(color = HistoryPanel, shape = RoundedCornerShape(20.dp), modifier = modifier.fillMaxWidth()) {
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
                    Text(movie.releaseYear.toString(), color = HistoryGold, fontSize = 12.sp, fontWeight = FontWeight.Black, modifier = Modifier.padding(horizontal = 7.dp, vertical = 4.dp))
                }
            }
            Spacer(Modifier.width(14.dp))
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(
                    movie.title,
                    color = HistoryText,
                    fontSize = 18.sp,
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
                            fontSize = 12.sp,
                            lineHeight = 14.sp,
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                val meta = listOfNotNull(movie.language, movie.countryCode).filter { it.isNotBlank() }.joinToString(" • ")
                if (meta.isNotBlank()) Text(meta, color = HistoryMuted, fontSize = 12.sp)
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                    Surface(color = HistoryGold.copy(alpha = 0.10f), shape = RoundedCornerShape(50)) {
                        Text(
                            when(movie.yearsAgo){0->"Released today";1->"1 year ago today";else->movie.yearsAgo.toString()+" years ago today"},
                            color = HistoryGold,
                            fontSize = 12.sp,
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
                                fontSize = 12.sp,
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

private fun historyVerificationLabelV070(value: String): String = when (value.uppercase(Locale.ENGLISH)) {
    "VERIFIED", "CONFIRMED", "OFFICIAL" -> "Confirmed"
    "UNVERIFIED", "UNKNOWN" -> "Needs checking"
    else -> value.lowercase(Locale.ENGLISH).replace('_', ' ').replaceFirstChar { it.titlecase(Locale.ENGLISH) }
}
    .lowercase(Locale.ENGLISH)
    .split('_')
    .filter { it.isNotBlank() }
    .joinToString(" ") { token -> token.replaceFirstChar { it.titlecase(Locale.ENGLISH) } }
