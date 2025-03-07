# ADR 001: Assess migration to OTP2

## Context

Clean Air Council’s GoPhillyGo application allows users to browse the greater Philadelphia area’s educational and recreational destinations and events. Users can explore or plan travel to these places of interest using the multi-modal trip planner, which combines biking, walking and public transportation. To support this functionality, GoPhillyGo uses a locally hosted Open Trip Planner instance running in a Java Virtual Machine.

### Core Features to Evaluate

Currently we use the following OTP v1.4 features:

- Compile and build a transportation network graph for the greater Philadelphia region using the following sources: 
    - SEPTA, PATCO, NJTransit, and DART GTFS[^1] feeds
    - PBF OpenStreetMap file clipped to greater Philadelphia area
    - High resolution tif elevation file for greater Philadelphia area
    - GBFS[^1] feed of live Indego station location and status information
- Handle mutli-modal travel itinerary requests
- Handle mutli-modal travel itinerary requests with parameters to optimize route based on the following characteristics:
    - “Flat / “Safe” / “Fast” bike routing
    - Wheelchair accessibility
    - Scheduled departure / arrival time frame (single departure or arrival time only)
- Handle request to fetch isochrone geometry used for building travel shed

[^1]: Noting here that GTFS and GBFS are open data standard formats for public transit information and mobility information (like bikeshare), respectively.

### Why OTP2

Since initially implementing OTPv1.4 there have been changes in the GTFS standard that some of our feeds (SEPTA, specifically) have adopted. This revised spec is not supported by OTP v1.4 so we’ve added manual pre-processing steps when fetching feed data to ensure monthly transit data updates still work. However, our current deployment setup is outdated and additionally these one-off fixes for feed formatting changes have made our deployment setup more difficult to follow and increasingly fragile.

The next major release, OTP2, not only supports the updated GTFS format but addresses routing performance issues and includes passenger-facing itinerary services. This version update would introduce stability into our data deployment process and may provide better support for any incoming transit feed format revisions in the future. However, OTP2 is a complete rewrite that has a more limited, focused feature set so it may not be possible to use with our application. This ADR is to evaluate the feasibility of this major version upgrade and come to a go/no-go conclusion.

### Evaluation criteria

- Supports all core features currently in use by GoPhillyGo
- Maintenance and security support through current contract
- Supports current GTFS and GBFS standard formats
- Effort to adapt codebase to OTP setup/run commands, server and graph configuration, and REST API is feasible within remaining time and budget

### OTP1 vs OTP2 Assessment

Noting first that there is an [available OTP1 --> OTP2 migration guide](https://docs.opentripplanner.org/en/latest/Version-Comparison/#migration-guide) as well as [detailed comparison page](https://docs.opentripplanner.org/en/v2.3.0/Version-Comparison/#summary) in the offical Open Trip Planner docs.

#### OTP 1.4

**Pros:**
- Current implementation of core features
- OTP1 maintenance status appears to have long-term support
    - From the OTP repo CHANGELOG: “OTP1 is essentially a legacy product that will receive bug and stability fixes to the extent that they can be readily backported from OTP2”.
- Graph build process already refined	
    - Feed sources, data configurations, and necessary commands already setup using ansible roles
    - Official docs detail graph hot reloading as a unique OTP1 feature, allowing us to update transit feeds without re-building the graph each month (the most time-intensive part of monthly deployments) which could be worth investigating as part of automating data deployment.

**Cons:**
- Does not support updated GTFS data format, which affects SEPTA transit feed
    - Minimal changes (converting trolleybuses) to allow graph to build, however sometimes other formatting errors in GTFS data feeds and manually validating can be time intensive 
- We are one minor version behind, should still upgrade to capture latest bugfixes
    - While it will be minor update changes we don’t have other projects with Java VM environments to develop a strong familiarity and we haven’t updated OTP in years so potentially unexpected lift
    - From release notes: “Version 1.5 of OpenTripPlanner was released just before version 2.0. It is intended to serve as a final release integrating any bugfixes backported from the 2.x development as the 1.x track moves into legacy/maintenance status.”
- OTP1 will remain but OTP2 is recommended practice
    - At the time of writing, the OTP official documentation notes that OTP2 is not intended to supersede OTP1 and the online recommendation for new users is to “try out OTP2 and switch to OTP1 if they need features that are not available in OTP2”.

#### OTP 2

**Pros:**
- Actively developed with large community of contributers and is stable version for the foreseeable future
- Aligned with GTFS and GBFS feed formats and likely will maintain alignment
- More efficient graph building and performant routing 

**Cons:**
- Does not support core features
    - OTP2 has removed isochrone generation entirely, so we will not be able to generate the travel shed geometry which we use to find destinations within a defined travel radius. This critically affects the “Explore” mode
- Sweeping changes to routing API
    - Does not support "bcycle" rental bike updator out of the box, which we currently use for indigo rental bike information like station updates
    - Update in routing optimization parameters.
        - While the REST API is unchanged it's mapped into a new structure.
        - Not all combinations of non-transit modes available in OTP1 are available in OTP2's new structure (potentially affecting our "slow"/"fast"/"flat" optimizations)
        - Would be a moderate lift detailed in the migration guide linked above, namely affecting parameter names and optimizations syntax in our frontend jQuery logic when creating routing queries.
- Does not have graph hot reloading
    - We don't currently use this, but it is an OTP1 feature that could potentially speed monthly data deployments
- Updates to graph config and setup commands
    - This should be a small lift and detailed in the migration guide linked above, however we haven't updated this configuration or ansible tasks in years
- Requires a Java version update for compatibility (v21+)

## Decision

While OTP2 has a better outlook for long-term development and maintenance and aligns with our sources' updated GTFS feed formats, its intention is for a more focused application (specifically on passenger information than travel analysis) that does not fit the current purpose of GoPhillyGo. The removal of isochrone generation alone would be a large cut in application functionality and user experience, taking away “Explore” mode. The lift to accommodate the new parameters and update rental bike configuration would also likely be not worth the remaining contract and, even if so, the OTP1 feature set is better suited for our purposes and the updates to manually format data feeds are minimal in comparison. The Open Trip Planner documentation explicitly states that OTP2 is not to supersede OTP1 and it will receive bug and stability fixes to the extent that they can be readily backported from OTP2, so we should have stability for the remainder of the current contract until we better understand future needs.

### Alternative Options

It's worth noting that the new transit router behind OTP2, that is not only updated for new feed formats but is more performant and allows greater travel time variability, was influenced by the work in Conveyal's R5 router. Conveyal Analysis and R5 were initially built from OTP1 and remain focused on research/urban analysis use cases, so it captures the OTP2 benefits while keeping core OTP1 feature support. For this reason it's the [recommended option for urban analysis projects from the OTP docs](https://docs.opentripplanner.org/en/latest/Analysis/#travel-time-analysis-in-otp1): "If you would like to apply the routing innovations present in OTP2 in analytics situations, we recommend taking a look at projects like R5 or the R and Python language wrappers for it created by the community."

Given the time and budget constraints of the current contract and unclear picture of future project needs, it does not make sense to more deeply assess a migration to R5. This change would be a heavy lift, affecting not only how our frontend and backend interact with a trip planning server but our project infrastructure, feed-fetching scripts, and graph-building process. However, if we're starting new projects that require trip planning software with a travel analysis component (like isochrone geometry for travel sheds or route optimizations) we should make a consideation for R5. 

## Consequences

- We should evaluate changes in OTP 1.5 to confirm no immediately obvious breaking changes in a minor version update and then complete the upgrade so that our OTP version can be in the more stable final release version
- As feed source formats are standardized we should be able to reliably automate any re-formatting as needed to bring files in line with what OTP1 can support
    - This will be captured in upcoming automate deployment process card
- As part of implementing deployment process automations we should look into graph hot reloading as a way to reduce monthly time spent re-building transit network graph
