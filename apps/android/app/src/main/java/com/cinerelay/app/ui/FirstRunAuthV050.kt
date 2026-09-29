package com.cinerelay.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.cinerelay.app.R

private val AuthInk = Color(0xFF090B0F)
private val AuthPanel = Color(0xFF15181E)
private val AuthRaised = Color(0xFF1C2028)
private val AuthLine = Color(0xFF2A303A)
private val AuthText = Color(0xFFF5F1E8)
private val AuthMuted = Color(0xFFA7ADB7)
private val AuthGold = Color(0xFFE7C36B)
private val AuthGreen = Color(0xFF72D6A4)
private val AuthRed = Color(0xFFF08079)

@Composable
fun FirstRunAuthV050(
    state: CineRelayUiState,
    onChooseMode: (AuthMode) -> Unit,
    onBack: () -> Unit,
    onSignIn: (String, String) -> Unit,
    onCreateAccount: (String, String) -> Unit,
    modifier: Modifier = Modifier,
) {
    Surface(modifier = modifier.fillMaxSize(), color = AuthInk) {
        if (state.authMode == null) {
            WelcomeGateV050(
                notice = state.notice,
                onSignIn = { onChooseMode(AuthMode.SIGN_IN) },
                onCreateAccount = { onChooseMode(AuthMode.CREATE_ACCOUNT) },
            )
        } else {
            AuthFormV050(
                mode = state.authMode,
                busy = state.authBusy,
                error = state.error,
                notice = state.notice,
                onBack = onBack,
                onSignIn = onSignIn,
                onCreateAccount = onCreateAccount,
            )
        }
    }
}

@Composable
private fun WelcomeGateV050(
    notice: String?,
    onSignIn: () -> Unit,
    onCreateAccount: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .statusBarsPadding()
            .navigationBarsPadding()
            .padding(horizontal = 28.dp, vertical = 24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Spacer(Modifier.weight(0.5f))
        AuthBrandMarkV050(76.dp)
        Spacer(Modifier.height(22.dp))
        Text("CINERELAY", color = AuthGold, fontSize = 11.sp, fontWeight = FontWeight.Black, letterSpacing = 2.2.sp)
        Spacer(Modifier.height(9.dp))
        Text(
            "Cinema intelligence,\nstraight from the source.",
            color = AuthText,
            fontSize = 31.sp,
            lineHeight = 37.sp,
            fontWeight = FontWeight.Bold,
        )
        Spacer(Modifier.height(15.dp))
        Text(
            "Sign in before entering the newsroom so your source choices, follows, alerts and preferences stay tied to your account.",
            color = AuthMuted,
            fontSize = 14.sp,
            lineHeight = 21.sp,
        )
        Spacer(Modifier.height(22.dp))
        Surface(color = AuthRaised, shape = RoundedCornerShape(18.dp), modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(11.dp)) {
                AuthPromiseV050("Official-source feed", "YouTube now; websites and feeds can join the same evidence pipeline.")
                AuthPromiseV050("Your control room", "Notification, source and content preferences stay synced to you.")
                AuthPromiseV050("Evidence first", "CineRelay keeps the original source attached to every useful update.")
            }
        }
        notice?.takeIf { it.isNotBlank() }?.let {
            Spacer(Modifier.height(12.dp))
            Text(it, color = AuthGreen, fontSize = 11.sp)
        }
        Spacer(Modifier.weight(1f))
        Button(
            onClick = onSignIn,
            colors = ButtonDefaults.buttonColors(containerColor = AuthGold, contentColor = AuthInk),
            modifier = Modifier.fillMaxWidth().height(52.dp),
            shape = RoundedCornerShape(15.dp),
        ) {
            Icon(Icons.Default.Lock, contentDescription = null, modifier = Modifier.size(17.dp))
            Spacer(Modifier.width(7.dp))
            Text("Sign in", fontWeight = FontWeight.Bold)
        }
        Spacer(Modifier.height(10.dp))
        OutlinedButton(
            onClick = onCreateAccount,
            modifier = Modifier.fillMaxWidth().height(52.dp),
            shape = RoundedCornerShape(15.dp),
        ) {
            Text("Create account", color = AuthText, fontWeight = FontWeight.Bold)
        }
        Spacer(Modifier.height(8.dp))
        Text("No guest newsroom in this build.", color = AuthMuted, fontSize = 10.sp)
    }
}

@Composable
private fun AuthPromiseV050(title: String, body: String) {
    Row(verticalAlignment = Alignment.Top) {
        Icon(Icons.Default.CheckCircle, contentDescription = null, tint = AuthGreen, modifier = Modifier.size(18.dp))
        Spacer(Modifier.width(10.dp))
        Column {
            Text(title, color = AuthText, fontSize = 12.sp, fontWeight = FontWeight.Bold)
            Text(body, color = AuthMuted, fontSize = 10.sp, lineHeight = 15.sp)
        }
    }
}

@Composable
private fun AuthFormV050(
    mode: AuthMode,
    busy: Boolean,
    error: String?,
    notice: String?,
    onBack: () -> Unit,
    onSignIn: (String, String) -> Unit,
    onCreateAccount: (String, String) -> Unit,
) {
    var email by remember(mode) { mutableStateOf("") }
    var password by remember(mode) { mutableStateOf("") }
    val create = mode == AuthMode.CREATE_ACCOUNT

    Column(
        modifier = Modifier
            .fillMaxSize()
            .statusBarsPadding()
            .navigationBarsPadding()
            .padding(horizontal = 22.dp, vertical = 10.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onBack, enabled = !busy) {
                Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = AuthText)
            }
            Spacer(Modifier.width(4.dp))
            Text("CINERELAY", color = AuthGold, fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 1.8.sp)
        }

        Spacer(Modifier.weight(0.35f))
        AuthBrandMarkV050(60.dp)
        Spacer(Modifier.height(18.dp))
        Text(
            if (create) "Create your CineRelay account" else "Welcome back",
            color = AuthText,
            fontSize = 26.sp,
            lineHeight = 32.sp,
            fontWeight = FontWeight.Bold,
        )
        Spacer(Modifier.height(8.dp))
        Text(
            if (create) "Your first login will continue into source and notification setup."
            else "Sign in to restore your source choices, follows and alert preferences.",
            color = AuthMuted,
            fontSize = 13.sp,
            lineHeight = 19.sp,
        )
        Spacer(Modifier.height(22.dp))

        OutlinedTextField(
            value = email,
            onValueChange = { email = it },
            modifier = Modifier.fillMaxWidth(),
            label = { Text("Email") },
            singleLine = true,
            enabled = !busy,
            colors = authFieldColorsV050(),
        )
        Spacer(Modifier.height(12.dp))
        OutlinedTextField(
            value = password,
            onValueChange = { password = it },
            modifier = Modifier.fillMaxWidth(),
            label = { Text("Password") },
            singleLine = true,
            enabled = !busy,
            visualTransformation = PasswordVisualTransformation(),
            colors = authFieldColorsV050(),
        )

        notice?.takeIf { it.isNotBlank() }?.let {
            Spacer(Modifier.height(11.dp))
            Text(it, color = AuthGreen, fontSize = 11.sp, lineHeight = 16.sp)
        }
        error?.takeIf { it.isNotBlank() }?.let {
            Spacer(Modifier.height(11.dp))
            Text(it, color = AuthRed, fontSize = 11.sp, lineHeight = 16.sp)
        }

        Spacer(Modifier.height(18.dp))
        Button(
            onClick = {
                if (create) onCreateAccount(email, password) else onSignIn(email, password)
            },
            enabled = !busy,
            colors = ButtonDefaults.buttonColors(containerColor = AuthGold, contentColor = AuthInk),
            modifier = Modifier.fillMaxWidth().height(52.dp),
            shape = RoundedCornerShape(15.dp),
        ) {
            if (busy) CircularProgressIndicator(Modifier.size(19.dp), strokeWidth = 2.dp, color = AuthInk)
            else Text(if (create) "Create account" else "Sign in", fontWeight = FontWeight.Bold)
        }

        Spacer(Modifier.height(10.dp))
        Text(
            if (create) "After account creation, CineRelay may ask you to confirm your email before signing in."
            else "After sign-in, CineRelay checks whether onboarding is already complete before opening Home.",
            color = AuthMuted,
            fontSize = 10.sp,
            lineHeight = 15.sp,
        )
        Spacer(Modifier.weight(1f))
    }
}

@Composable
fun CineRelaySetupLoadingV050(modifier: Modifier = Modifier) {
    Surface(modifier = modifier.fillMaxSize(), color = AuthInk) {
        Column(
            modifier = Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            AuthBrandMarkV050(64.dp)
            Spacer(Modifier.height(20.dp))
            CircularProgressIndicator(color = AuthGold, strokeWidth = 2.dp)
            Spacer(Modifier.height(12.dp))
            Text("Loading your CineRelay setup", color = AuthMuted, fontSize = 12.sp)
        }
    }
}

@Composable
private fun AuthBrandMarkV050(size: androidx.compose.ui.unit.Dp) {
    Surface(
        color = AuthGold.copy(alpha = 0.08f),
        shape = RoundedCornerShape(size / 3),
        modifier = Modifier.size(size),
    ) {
        androidx.compose.foundation.layout.Box(contentAlignment = Alignment.Center) {
            Icon(
                painter = painterResource(R.drawable.ic_cinerelay_mark),
                contentDescription = null,
                tint = Color.Unspecified,
                modifier = Modifier.size(size * 0.9f),
            )
        }
    }
}

@Composable
private fun authFieldColorsV050() = OutlinedTextFieldDefaults.colors(
    focusedTextColor = AuthText,
    unfocusedTextColor = AuthText,
    focusedBorderColor = AuthGold,
    unfocusedBorderColor = AuthLine,
    focusedLabelColor = AuthGold,
    unfocusedLabelColor = AuthMuted,
    cursorColor = AuthGold,
    focusedContainerColor = AuthPanel,
    unfocusedContainerColor = AuthPanel,
)
