package com.cinerelay.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** Compact discovery hierarchy shared by OTT, Radar, and Indian cinema history. */
internal object DiscoveryUiV080 {
    val Gold = Color(0xFFE8C56D)
    val Text = Color(0xFFF5F2EA)
    val Muted = Color(0xFFA8ADB7)
    val Panel = Color(0xFF171A20)
    val Raised = Color(0xFF20242C)
    val Gutter = 16.dp
    val CardWidth = 236.dp
    val CardRadius = 18.dp
}
@Composable
internal fun DiscoverySectionHeadingV080(title:String,subtitle:String,count:Int,onSeeAll:()->Unit){
    Row(Modifier.fillMaxWidth().padding(horizontal=DiscoveryUiV080.Gutter),
        verticalAlignment=Alignment.CenterVertically){
        Column(Modifier.weight(1f),verticalArrangement=Arrangement.spacedBy(3.dp)){
            Text(title,color=DiscoveryUiV080.Text,fontSize=19.sp,fontWeight=FontWeight.Bold,
                maxLines=2,overflow=TextOverflow.Ellipsis)
            if(subtitle.isNotBlank()) Text(subtitle,color=DiscoveryUiV080.Muted,fontSize=12.sp,
                maxLines=2,overflow=TextOverflow.Ellipsis)
        }
        TextButton(onClick=onSeeAll,enabled=count>0){
            Text("See all ("+count+")",color=if(count>0)DiscoveryUiV080.Gold else DiscoveryUiV080.Muted,
                fontSize=12.sp,fontWeight=FontWeight.SemiBold)
            Icon(Icons.Default.ChevronRight,contentDescription=null,
                tint=DiscoveryUiV080.Gold,modifier=Modifier.size(17.dp))
        }
    }
}
@Composable
internal fun DiscoverySubpageHeaderV080(title:String,subtitle:String,onBack:()->Unit){
    Row(Modifier.fillMaxWidth().padding(start=6.dp,end=16.dp,top=12.dp,bottom=12.dp),
        verticalAlignment=Alignment.CenterVertically){
        IconButton(onClick=onBack){
            Icon(Icons.Default.ArrowBack,contentDescription="Back",tint=DiscoveryUiV080.Text)
        }
        Column(Modifier.weight(1f),verticalArrangement=Arrangement.spacedBy(3.dp)){
            Text(title,color=DiscoveryUiV080.Text,fontSize=23.sp,fontWeight=FontWeight.Bold,
                maxLines=2,overflow=TextOverflow.Ellipsis)
            if(subtitle.isNotBlank())Text(subtitle,color=DiscoveryUiV080.Muted,fontSize=12.sp,maxLines=2)
        }
    }
}
