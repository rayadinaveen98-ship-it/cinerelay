package com.cinerelay.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.LaunchedEffect
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
import com.cinerelay.app.ui.NewsroomPlatform
import com.cinerelay.app.ui.NewsroomPlatformOverlay
import com.cinerelay.app.ui.NewsroomSourceRoleOverlay
import com.cinerelay.app.ui.P6039BottomNavOverlay
import com.cinerelay.app.ui.SourcesDirectoryV039
import com.cinerelay.app.ui.SourcesViewModel

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        setContent {
            val viewModel: CineRelayViewModel = viewModel()
            val sourcesViewModel: SourcesViewModel = viewModel()
            val state by viewModel.state.collectAsStateWithLifecycle()
            val sourcesState by sourcesViewModel.state.collectAsStateWithLifecycle()

            LaunchedEffect(state.tab, state.newsroomPlatform, state.authMode) {
                if (state.tab == AppTab.FOLLOWING && state.authMode == null) {
                    sourcesViewModel.load(state.newsroomPlatform)
                }
            }

            Box(Modifier.fillMaxSize()) {
                CineRelayV02App(viewModel)

                if (state.tab == AppTab.FOLLOWING && state.authMode == null) {
                    SourcesDirectoryV039(
                        state = sourcesState,
                        onRefresh = sourcesViewModel::refresh,
                        onOpenSource = sourcesViewModel::openSource,
                        onCloseSource = sourcesViewModel::closeSource,
                        modifier = Modifier.fillMaxSize(),
                    )
                }

                if (state.authMode == null) {
                    if (state.tab == AppTab.LIVE && state.newsroomPlatform == NewsroomPlatform.YOUTUBE) {
                        NewsroomSourceRoleOverlay(
                            selected = state.newsroomSourceRole,
                            counts = state.newsroomSourceRoleCounts,
                            onSelect = viewModel::setNewsroomSourceRole,
                            modifier = Modifier
                                .align(Alignment.BottomCenter)
                                .padding(bottom = 148.dp),
                        )
                    }

                    if (state.tab == AppTab.LIVE || state.tab == AppTab.FOLLOWING) {
                        NewsroomPlatformOverlay(
                            selected = state.newsroomPlatform,
                            onSelect = viewModel::setNewsroomPlatform,
                            modifier = Modifier
                                .align(Alignment.BottomStart)
                                .padding(start = 16.dp, bottom = 92.dp),
                        )
                    }

                    if (state.tab == AppTab.LIVE) {
                        NewsroomFilterOverlay(
                            selected = state.newsroomFilter,
                            counts = state.newsroomFilterCounts,
                            onSelect = viewModel::setNewsroomFilter,
                            modifier = Modifier
                                .align(Alignment.BottomEnd)
                                .padding(end = 16.dp, bottom = 92.dp),
                        )
                    }

                    P6039BottomNavOverlay(
                        selected = state.tab,
                        onSelect = viewModel::selectTab,
                        modifier = Modifier.align(Alignment.BottomCenter),
                    )
                }
            }
        }
    }
}
