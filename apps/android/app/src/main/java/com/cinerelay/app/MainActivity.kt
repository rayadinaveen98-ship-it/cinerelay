package com.cinerelay.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.core.view.WindowCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.cinerelay.app.ui.AppTab
import com.cinerelay.app.ui.CineRelayV02App
import com.cinerelay.app.ui.CineRelayViewModel
import com.cinerelay.app.ui.NewsroomFilterOverlay

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        setContent {
            val viewModel: CineRelayViewModel = viewModel()
            val state by viewModel.state.collectAsStateWithLifecycle()

            Box(Modifier.fillMaxSize()) {
                CineRelayV02App(viewModel)
                if (state.tab == AppTab.LIVE && state.authMode == null) {
                    NewsroomFilterOverlay(
                        selected = state.newsroomFilter,
                        counts = state.newsroomFilterCounts,
                        onSelect = viewModel::setNewsroomFilter,
                        modifier = Modifier
                            .align(Alignment.BottomEnd)
                            .padding(end = 16.dp, bottom = 92.dp),
                    )
                }
            }
        }
    }
}
