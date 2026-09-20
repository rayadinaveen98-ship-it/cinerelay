import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.plugin.compose")
}

val localProperties = Properties().apply {
    val file = rootProject.file("local.properties")
    if (file.exists()) file.inputStream().use(::load)
}

fun publicConfig(name: String, fallback: String): String =
    providers.environmentVariable(name).orNull
        ?: localProperties.getProperty(name)
        ?: fallback

val firebaseConfigured = file("google-services.json").exists()
if (firebaseConfigured) {
    apply(plugin = "com.google.gms.google-services")
}

val configuredVersionCode = providers.environmentVariable("CINERELAY_VERSION_CODE").orNull?.toIntOrNull()
val configuredVersionName = providers.environmentVariable("CINERELAY_VERSION_NAME").orNull
val signingStoreFile = providers.environmentVariable("CINERELAY_SIGNING_STORE_FILE").orNull
val signingStorePassword = providers.environmentVariable("CINERELAY_SIGNING_STORE_PASSWORD").orNull
val signingKeyAlias = providers.environmentVariable("CINERELAY_SIGNING_KEY_ALIAS").orNull
val signingKeyPassword = providers.environmentVariable("CINERELAY_SIGNING_KEY_PASSWORD").orNull
val updateSigningConfigured = listOf(
    signingStoreFile,
    signingStorePassword,
    signingKeyAlias,
    signingKeyPassword,
).all { !it.isNullOrBlank() }

android {
    namespace = "com.cinerelay.app"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.cinerelay.app"
        minSdk = 26
        targetSdk = 36
        versionCode = configuredVersionCode ?: 4
        versionName = configuredVersionName ?: "0.2.1-canary"

        buildConfigField("String", "SUPABASE_URL", "\"${publicConfig("CINERELAY_SUPABASE_URL", "https://dnqaejljfzwhsainpdxb.supabase.co")}\"")
        buildConfigField("String", "SUPABASE_PUBLISHABLE_KEY", "\"${publicConfig("CINERELAY_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_hR65p2JkQ2x5fFLx_kkcNQ_1SxNN3QP")}\"")
        buildConfigField("boolean", "FIREBASE_CONFIGURED", firebaseConfigured.toString())
        buildConfigField("boolean", "UPDATE_SIGNING_CONFIGURED", updateSigningConfigured.toString())
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    packaging {
        resources.excludes += setOf("/META-INF/{AL2.0,LGPL2.1}")
    }

    val stableSigning = if (updateSigningConfigured) {
        signingConfigs.create("cinerelayStable") {
            storeFile = file(signingStoreFile!!)
            storePassword = signingStorePassword
            keyAlias = signingKeyAlias
            keyPassword = signingKeyPassword
        }
    } else {
        null
    }

    buildTypes {
        debug {
            versionNameSuffix = "+debug"
            stableSigning?.let { signingConfig = it }
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            stableSigning?.let { signingConfig = it }
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
    }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2026.04.01")
    implementation(composeBom)

    implementation("androidx.core:core-ktx:1.17.0")
    implementation("androidx.activity:activity-compose:1.12.4")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.10.0")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.10.0")
    implementation("androidx.lifecycle:lifecycle-viewmodel-ktx:2.10.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.11.0")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    debugImplementation("androidx.compose.ui:ui-tooling")

    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("io.coil-kt.coil3:coil-compose:3.5.0")
    implementation("io.coil-kt.coil3:coil-network-okhttp:3.5.0")

    implementation(platform("com.google.firebase:firebase-bom:34.19.0"))
    implementation("com.google.firebase:firebase-messaging")
}
