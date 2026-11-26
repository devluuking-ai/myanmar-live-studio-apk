cmake_minimum_required(VERSION 3.22.1)
project(livestudio)

add_library(node SHARED IMPORTED)
set_target_properties(node PROPERTIES IMPORTED_LOCATION
    ${CMAKE_SOURCE_DIR}/../jniLibs/${ANDROID_ABI}/libnode.so)

add_library(native-lib SHARED native-lib.cpp)

target_include_directories(native-lib PRIVATE ${CMAKE_SOURCE_DIR}/include)
target_link_libraries(native-lib node log)
