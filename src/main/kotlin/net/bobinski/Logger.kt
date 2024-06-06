package net.bobinski

import org.slf4j.LoggerFactory

object Logger {
    fun get(clazz: Class<*>): org.slf4j.Logger = LoggerFactory.getLogger(clazz)
}