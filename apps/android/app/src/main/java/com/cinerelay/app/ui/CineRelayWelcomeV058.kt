package com.cinerelay.app.ui

import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlin.math.PI
import kotlin.math.sin

private val WelcomeInk58 = Color(0xFF07090D)
private val WelcomeGold58 = Color(0xFFE8C56D)

@Composable
fun CineRelayWelcomeV058(
    onFinished: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val travel = remember { Animatable(0f) }
    val converge = remember { Animatable(0f) }
    var revealName by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        launch(Dispatchers.Default) { runCatching { playWelcomeSoundV058() } }
        travel.animateTo(1f, tween(1_900, easing = LinearEasing))
        converge.animateTo(1f, tween(1_050, easing = FastOutSlowInEasing))
        revealName = true
        delay(620)
        onFinished()
    }

    Box(
        modifier = modifier.fillMaxSize().background(
            Brush.radialGradient(
                colors = listOf(Color(0xFF171224), WelcomeInk58, Color.Black),
                radius = 1_300f,
            ),
        ),
        contentAlignment = Alignment.Center,
    ) {
        Canvas(Modifier.fillMaxSize()) {
            val center = Offset(size.width / 2f, size.height / 2f)
            val palette = listOf(
                Color(0xFFFF4F9A), Color(0xFF7B6CFF), Color(0xFF30D6FF),
                Color(0xFFFFB94A), Color(0xFF5CF29A), Color(0xFFFF715B),
                Color(0xFFC06CFF), Color(0xFF53A7FF), Color(0xFFFFE66D),
            )
            repeat(18) { index ->
                val side = index % 4
                val lane = (index / 4f) / 5f
                val start = when (side) {
                    0 -> Offset(-80f, size.height * (0.12f + lane * 0.75f))
                    1 -> Offset(size.width + 80f, size.height * (0.10f + lane * 0.78f))
                    2 -> Offset(size.width * (0.10f + lane * 0.78f), -80f)
                    else -> Offset(size.width * (0.12f + lane * 0.75f), size.height + 80f)
                }
                val drift = travel.value
                val targetBeforeLock = Offset(
                    x = center.x + sin(index * 0.91f + drift * 5f) * size.width * 0.34f * (1f - drift),
                    y = center.y + sin(index * 1.37f + drift * 4f) * size.height * 0.24f * (1f - drift),
                )
                val target = Offset(
                    x = targetBeforeLock.x + (center.x - targetBeforeLock.x) * converge.value,
                    y = targetBeforeLock.y + (center.y - targetBeforeLock.y) * converge.value,
                )
                val mid1 = Offset(
                    x = start.x + (target.x - start.x) * 0.35f + sin(index * 0.7f + drift * 9f) * 90f,
                    y = start.y + (target.y - start.y) * 0.30f + sin(index * 1.2f + drift * 8f) * 70f,
                )
                val mid2 = Offset(
                    x = start.x + (target.x - start.x) * 0.72f + sin(index * 1.1f + drift * 7f) * 65f,
                    y = start.y + (target.y - start.y) * 0.68f + sin(index * 0.8f + drift * 9f) * 55f,
                )
                val path = Path().apply {
                    moveTo(start.x, start.y)
                    cubicTo(mid1.x, mid1.y, mid2.x, mid2.y, target.x, target.y)
                }
                val color = palette[index % palette.size]
                drawPath(path, color.copy(alpha = 0.12f + 0.68f * travel.value), style = Stroke(width = 12f))
                drawPath(path, color.copy(alpha = 0.65f + 0.30f * travel.value), style = Stroke(width = 3.3f))
            }
            if (converge.value > 0.45f) {
                drawCircle(
                    brush = Brush.radialGradient(listOf(WelcomeGold58.copy(alpha = 0.38f * converge.value), Color.Transparent)),
                    radius = 260f * converge.value,
                    center = center,
                )
            }
        }

        if (revealName) {
            Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.padding(horizontal = 24.dp)) {
                Text("CINERELAY", color = Color.White, fontSize = 38.sp, fontWeight = FontWeight.Black, letterSpacing = 3.8.sp)
                Text("CINEMA · STORIES · SIGNALS", color = WelcomeGold58, fontSize = 9.sp, fontWeight = FontWeight.Bold, letterSpacing = 2.0.sp)
            }
        }
    }
}

private fun playWelcomeSoundV058() {
    val sampleRate = 44_100
    val durationSeconds = 3.55
    val count = (sampleRate * durationSeconds).toInt()
    val buffer = ShortArray(count)
    for (i in 0 until count) {
        val t = i.toDouble() / sampleRate
        val p = t / durationSeconds
        val rise = (p.coerceIn(0.0, 1.0))
        val envelope = when {
            p < 0.08 -> p / 0.08
            p < 0.82 -> 0.82
            else -> ((1.0 - p) / 0.18).coerceAtLeast(0.0)
        }
        val base = 110.0 + 150.0 * rise
        val shimmer = 420.0 + 760.0 * rise
        val tonal = sin(2.0 * PI * base * t) * 0.26 + sin(2.0 * PI * shimmer * t) * 0.09
        val pulse = if (p > 0.70) sin(2.0 * PI * 58.0 * t) * ((p - 0.70) / 0.30) * 0.16 else 0.0
        val whoosh = sin(2.0 * PI * (70.0 + 1_300.0 * p * p) * t) * (1.0 - p) * 0.08
        val sample = ((tonal + pulse + whoosh) * envelope * Short.MAX_VALUE * 0.52)
            .toInt().coerceIn(Short.MIN_VALUE.toInt(), Short.MAX_VALUE.toInt())
        buffer[i] = sample.toShort()
    }

    val track = AudioTrack.Builder()
        .setAudioAttributes(
            AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ASSISTANCE_SONIFICATION)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build(),
        )
        .setAudioFormat(
            AudioFormat.Builder()
                .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                .setSampleRate(sampleRate)
                .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                .build(),
        )
        .setBufferSizeInBytes(buffer.size * 2)
        .setTransferMode(AudioTrack.MODE_STATIC)
        .build()
    try {
        track.write(buffer, 0, buffer.size)
        track.play()
        Thread.sleep((durationSeconds * 1_000).toLong())
    } finally {
        runCatching { track.stop() }
        track.release()
    }
}
