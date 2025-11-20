FROM openjdk:11.0.16-jre-bullseye

ENV VERSION=1.5.0 \
    JAVA_MX=15G

ADD https://repo1.maven.org/maven2/org/opentripplanner/otp/$VERSION/otp-$VERSION-shaded.jar /usr/local/share/java/
RUN echo "012f1a6d41222f3b54e3d03e587a52e34f93f8e6  /usr/local/share/java/otp-$VERSION-shaded.jar" | sha1sum --check
RUN ln -s otp-$VERSION-shaded.jar /usr/local/share/java/otp.jar

COPY otp /usr/local/bin/
RUN chmod 755 /usr/local/bin/*
