FROM openjdk:8u322-jre-bullseye

ENV VERSION=1.5.0 \
    JAVA_MX=15G

ADD https://repo1.maven.org/maven2/org/opentripplanner/otp/$VERSION/otp-$VERSION-shaded.jar /usr/local/share/java/
RUN echo "0367b1a15bac5f587807a5b897a9734209f8135c  /usr/local/share/java/otp-$VERSION-shaded.jar" | sha1sum --check
RUN ln -s otp-$VERSION-shaded.jar /usr/local/share/java/otp.jar

COPY otp /usr/local/bin/
RUN chmod 755 /usr/local/bin/*
