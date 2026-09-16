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

android {
    namespace = "com.cinerelay.app"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.cinerelay.app"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "0.1.0-canary"

        buildConfigField("String", "SUPABASE_URL", "\"${publicConfig("CINERELAY_SUPABASE_URL", "https://dnqaejljfzwhsainpdxb.supabase.co")}\"")
        buildConfigField("String", "SUPABASE_PUBLISHABLE_KEY", "\"${publicConfig("CINERELAY_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_hR65p2JkQ2x5fFLx_kkcNQ_1SxNN3QP")}\"")
        buildConfigField("boolean", "FIREBASE_CONFIGURED", firebaseConfigured.toString())
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

    buildTypes {
        debug {
            versionNameSuffix = "+debug"
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
    }
}

dependencies {
    // Keep the V0.1 canary on the last stable Compose generation that supports compileSdk 36.
    // Compose 1.12+ moved its Android floor to compileSdk 37.
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

    // OkHttp 5.5 Android metadata requires compileSdk 37. 4.12 remains stable and
    // fully adequate for this canary's HTTPS/Auth/Edge API traffic on minSdk 26+.
    implementation("com.squareup.okhttp3:okhttp:4.12.0")

    implementation(platform("com.google.firebase:firebase-bom:34.19.0"))
    implementation("com.google.firebase:firebase-messaging")
}
