# Studcha 📚

Studcha is a clean, responsive study-room web app for studying with friends online.

## Current version

The first version includes:

- Create a study room with a unique 6-character code
- Join a room by code or shared URL
- Room members list
- Study-room chat UI
- 25-minute focus timer
- Session notes saved in the browser
- Light/dark mode
- Responsive mobile and desktop layout
- Local browser persistence for demo/testing

## Important: cross-device rooms

GitHub Pages can host the frontend, but it cannot by itself store and synchronize live chat data. The project therefore has a Firebase-ready architecture. A Firebase Realtime Database (or another realtime backend) should be connected before using Studcha as a real multi-device service.

Do not place server secrets in frontend code. Firebase Web App configuration values are designed to be public; database access must be protected with Firebase Authentication and Realtime Database Rules.

## Suggested production stack

- Frontend: HTML, CSS, JavaScript
- Hosting: GitHub Pages
- Authentication: Firebase Authentication (anonymous or email)
- Realtime data: Firebase Realtime Database
- Optional later: WebRTC for voice/video rooms

## Roadmap

1. Real-time cross-device room synchronization
2. User authentication and profiles
3. Room owner controls and moderation
4. Online presence / typing indicator
5. Shared Pomodoro timer
6. Study goals and tasks
7. File/image sharing
8. Voice/video study mode
9. PWA install support and offline shell
