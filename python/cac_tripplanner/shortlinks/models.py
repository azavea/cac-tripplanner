from django.db import models


class ShortenedLink(models.Model):
    """Represents a shortened URL used to share routes"""
    key = models.CharField(max_length=30, db_index=True)  # base-58-encoded UUID
    destination = models.CharField(max_length=2048)
    create_date = models.DateTimeField(auto_now_add=True)
    is_public = models.BooleanField(default=True)


class ShortenedLinkHit(models.Model):
    """Stores a hit on a ShortRouteURL"""
    link = models.ForeignKey(ShortenedLink)
    hit_date = models.DateTimeField(auto_now_add=True)
