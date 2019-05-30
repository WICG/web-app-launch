# Answers to [Security and Privacy Questionnaire](https://www.w3.org/TR/security-privacy-questionnaire/)

### 3.1 Does this specification deal with personally-identifiable information?

No.


### 3.2 Does this specification deal with high-value data?

No.


### 3.3 Does this specification introduce new state for an origin that persists across browsing sessions?

No.


### 3.4 Does this specification expose persistent, cross-origin state to the web?

No.

### 3.5 Does this specification expose any other data to an origin that it doesn’t currently have access to?

Kind of.

The new APIs will tell sites what caused their launch (e.g. 'file_handler', 'share_target'). Previously this information was not explicit, but could be inferred based on the url that was being visited (as sites are able to specify which url they want shares/file launches to open).

### 3.6 Does this specification enable new script execution/loading mechanisms?

No.


### 3.7 Does this specification allow an origin access to a user’s location?

No.


### 3.8 Does this specification allow an origin access to sensors on a user’s device?

No.


### 3.9 Does this specification allow an origin access to aspects of a user’s local computing environment?

No.


### 3.10 Does this specification allow an origin access to other devices?

No.


### 3.11 Does this specification allow an origin some measure of control over a user agent’s native UI?

Kind of. This API will allow sites to control what happens in some situations (such as clicking a link into a PWA, opening a file, or sharing something to the PWA).

Currently, this is likely to involve an installed PWA choosing to either
    
1. Open a new window
2. Focus an existing window
3. Show a notification (assuming relevant permissions have been granted).

In addition, this decision should only be delegated to the site in the case where the user hasn't expressed some preference (e.g. open all links in browser, open this link in a new tab/window).


### 3.12 Does this specification expose temporary identifiers to the web?

No.


### 3.13 Does this specification distinguish between behavior in first-party and third-party contexts?

Only first party contexts will receive launch events.


### 3.14 How should this specification work in the context of a user agent’s "incognito" mode?

Launch events will behave the same in incognito and normal browsing contexts.

### 3.15 Does this specification persist data to a user’s local device?

No.


### 3.16 Does this specification have a "Security Considerations" and "Privacy Considerations" section?

Yes. See the [explainer](explainer.md#security-and-privacy-considerations).


### 3.17 Does this specification allow downgrading default security characteristics?

No.