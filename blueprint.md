
# Project Blueprint

## Overview

This application provides a web interface for users to log in. The backend uses Puppeteer to automate authentication against an external service (learn.learn.nvidia.com) and returns a session token to the user.

## Style, Design, and Features

*   **Frontend:**
    *   A clean, centered login form.
    *   Uses React with Next.js for the user interface.
    *   Basic styling with Tailwind CSS.
    *   Displays error messages to the user.
*   **Backend:**
    *   An API endpoint (`/api/login`) to handle login requests.
    *   Uses Puppeteer to automate the login process on an external website in a headless browser.
    *   Returns a session token upon successful authentication.

## Current Plan

1.  **Install Dependencies:** Ensure all required npm packages, including `puppeteer`, are installed.
2.  **Update API Route (`/app/api/login/route.js`):**
    *   Replace the mock login logic with the Puppeteer-based authentication flow.
    *   The API will receive `email` and `password` in a POST request.
    *   On successful login, it will extract the `sessionid` cookie and return it as a token in a JSON response.
    .
3.  **Update Login Page (`/app/login/page.js`):**
    *   Modify the login form to accept an email and password.
    *   Ensure the form correctly submits the credentials to the `/api/login` endpoint.
    *   Handle the token received in the response from the API.
4.  **Create Root Redirect (`/app/page.js`):**
    *   Create a new page at the root of the application.
    *   This page will automatically redirect users to the `/login` page.
