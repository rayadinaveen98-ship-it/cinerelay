package com.cinerelay.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

/**
 * Small V0.1 navigation compatibility surface.
 *
 * Material3's NavigationBarItem is a RowScope extension. The canary keeps its
 * destination helper independent from RowScope so the screen can remain easy to
 * test and extract. This package-local overload preserves the call contract and
 * renders an equivalent compact navigation destination without relying on an
 * implicit RowScope receiver.
 */
@Composable
internal fun NavigationBarItem(
    selected: Boolean,
    onClick: () -> Unit,
    icon: @Composable () -> Unit,
    label: @Composable () -> Unit,
) {
    val contentColor = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant
    Surface(
        color = Color.Transparent,
        contentColor = contentColor,
        modifier = Modifier
            .width(80.dp)
            .clickable(onClick = onClick),
    ) {
        Column(
            modifier = Modifier.padding(vertical = 7.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Box(
                modifier = Modifier
                    .background(
                        if (selected) MaterialTheme.colorScheme.primary.copy(alpha = 0.14f) else Color.Transparent,
                        RoundedCornerShape(16.dp),
                    )
                    .padding(horizontal = 14.dp, vertical = 4.dp),
                contentAlignment = Alignment.Center,
            ) {
                Box(Modifier.size(24.dp), contentAlignment = Alignment.Center) { icon() }
            }
            Spacer(Modifier.height(2.dp))
            label()
        }
    }
}
