package com.cinerelay.app.ui

/**
 * Monotonic request generation used to discard asynchronous results from
 * superseded navigation and authentication sessions.
 *
 * ViewModels access this from the main dispatcher; it is not a cross-thread
 * synchronization primitive.
 */
internal class RequestEpochV25 {
    private var generation = 0L

    fun advance(): Long = ++generation

    fun invalidate() {
        ++generation
    }

    fun isCurrent(request: Long): Boolean = request == generation
}
