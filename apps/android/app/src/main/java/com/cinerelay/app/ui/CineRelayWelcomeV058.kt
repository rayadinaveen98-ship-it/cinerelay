package com.cinerelay.app.ui

import android.provider.Settings
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.cinerelay.app.BuildConfig
import kotlinx.coroutines.delay
import kotlin.math.abs
import kotlin.math.sin

private const val WelcomePreferencesNameV023 = "cinerelay_welcome"
private const val WelcomeVersionKeyV023 = "last_played_version"
private const val WelcomeDurationMsV023 = 2_950
private val WelcomeRedV023 = Color(0xFFE3282F)

internal object WelcomeVersionGateV023 {
    fun shouldPlay(lastPlayedVersion: String?, currentVersion: String): Boolean =
        lastPlayedVersion != currentVersion
}

@Composable
fun CineRelayWelcomeV058(
    onFinished: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val preferences = remember {
        context.getSharedPreferences(WelcomePreferencesNameV023, android.content.Context.MODE_PRIVATE)
    }
    val currentVersion = BuildConfig.VERSION_NAME.substringBefore('+')
    val shouldPlay = remember(currentVersion) {
        WelcomeVersionGateV023.shouldPlay(
            lastPlayedVersion = preferences.getString(WelcomeVersionKeyV023, null),
            currentVersion = currentVersion,
        )
    }
    val removeAnimations = remember {
        runCatching {
            Settings.Global.getFloat(
                context.contentResolver,
                Settings.Global.ANIMATOR_DURATION_SCALE,
                1f,
            ) == 0f
        }.getOrDefault(false)
    }

    if (!shouldPlay) {
        LaunchedEffect(Unit) { onFinished() }
        return
    }

    val progress = remember { Animatable(if (removeAnimations) 0.82f else 0f) }

    LaunchedEffect(removeAnimations, currentVersion) {
        if (removeAnimations) {
            delay(260)
        } else {
            progress.animateTo(
                targetValue = 1f,
                animationSpec = tween(WelcomeDurationMsV023, easing = LinearEasing),
            )
        }
        preferences.edit().putString(WelcomeVersionKeyV023, currentVersion).apply()
        onFinished()
    }

    val p = progress.value
    val firstScene = p < 0.55f
    val titleAlpha = smoothRange(p, 0.03f, 0.22f) * if (firstScene) 1f else 0f
    val taglineAlpha = smoothRange(p, 0.14f, 0.29f) * if (firstScene) 1f else 0f
    val finalAlpha = if (removeAnimations) 1f else {
        val fadeIn = smoothRange(p, 0.74f, 0.81f)
        val fadeOut = 1f - smoothRange(p, 0.965f, 1f)
        fadeIn * fadeOut
    }

    Box(
        modifier = modifier.fillMaxSize().background(Color.Black),
        contentAlignment = Alignment.Center,
    ) {
        Canvas(Modifier.fillMaxSize()) {
            if (firstScene) {
                drawRect(Color(0xFF08090C))

                // Diagonal projector-like spill from upper-left, intentionally restrained.
                drawRect(
                    brush = Brush.linearGradient(
                        colors = listOf(
                            Color.White.copy(alpha = 0.15f),
                            Color.White.copy(alpha = 0.035f),
                            Color.Transparent,
                        ),
                        start = Offset(-size.width * 0.10f, -size.height * 0.08f),
                        end = Offset(size.width * 0.72f, size.height * 0.72f),
                    ),
                )

                // Lightweight deterministic grain: no bitmap/video/Lottie payload.
                repeat(190) { index ->
                    val seed = index * 12.9898f + p * 89.13f
                    val x = abs(sin(seed) * 43758.5453f % 1f) * size.width
                    val y = abs(sin(seed * 1.731f) * 24634.6345f % 1f) * size.height
                    val grainAlpha = 0.025f + abs(sin(seed * 0.43f)) * 0.07f
                    drawCircle(
                        color = Color.White.copy(alpha = grainAlpha),
                        radius = 0.7f + (index % 3) * 0.35f,
                        center = Offset(x, y),
                    )
                }
            } else {
                drawRect(Color.Black)

                if (!removeAnimations && p in 0.56f..0.76f) {
                    val scan = ((p - 0.56f) / 0.20f).coerceIn(0f, 1f)
                    val x = size.width * scan
                    drawRect(
                        brush = Brush.horizontalGradient(
                            colors = listOf(
                                Color.Transparent,
                                WelcomeRedV023.copy(alpha = 0.08f),
                                WelcomeRedV023.copy(alpha = 0.34f),
                                WelcomeRedV023.copy(alpha = 0.08f),
                                Color.Transparent,
                            ),
                            startX = x - 72f,
                            endX = x + 18f,
                        ),
                        topLeft = Offset(x - 72f, 0f),
                        size = androidx.compose.ui.geometry.Size(90f, size.height),
                    )
                    drawLine(
                        color = WelcomeRedV023,
                        start = Offset(x, 0f),
                        end = Offset(x, size.height),
                        strokeWidth = 2.2f,
                    )
                }
            }
        }

        if (firstScene) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(10.dp),
                modifier = Modifier.padding(horizontal = 24.dp),
            ) {
                Text(
                    text = "CineRelay",
                    color = Color.White,
                    fontSize = 42.sp,
                    fontFamily = FontFamily.Serif,
                    fontWeight = FontWeight.Medium,
                    letterSpacing = 0.4.sp,
                    modifier = Modifier.alpha(titleAlpha),
                )
                Text(
                    text = "The signal behind the story",
                    color = Color.White.copy(alpha = 0.74f),
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Normal,
                    letterSpacing = 1.1.sp,
                    modifier = Modifier.alpha(taglineAlpha),
                )
            }
        } else if (finalAlpha > 0f) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.alpha(finalAlpha),
            ) {
                Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier
                        .size(32.dp)
                        .clip(RoundedCornerShape(9.dp))
                        .background(Color.White),
                ) {
                    Text(
                        text = "C",
                        color = Color.Black,
                        fontSize = 19.sp,
                        fontFamily = FontFamily.Serif,
                        fontWeight = FontWeight.Bold,
                    )
                }
                Text(
                    text = "CineRelay",
                    color = Color.White,
                    fontSize = 34.sp,
                    fontFamily = FontFamily.Serif,
                    fontWeight = FontWeight.Medium,
                    letterSpacing = 0.25.sp,
                )
            }
        }
    }
}

private fun smoothRange(value: Float, start: Float, end: Float): Float =
    ((value - start) / (end - start)).coerceIn(0f, 1f)
