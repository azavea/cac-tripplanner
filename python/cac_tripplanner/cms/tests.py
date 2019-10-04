from datetime import timedelta

from django.contrib.auth.models import User
from django.core.files import File
from django.urls import reverse
from django.test import TestCase, Client
from django.utils.timezone import now

from cms.models import Article


class ArticleTests(TestCase):
    def setUp(self):
        user = User.objects.create_user(username='test-user')
        test_image = File(open('default_media/square/BartramsGarden.jpg'))

        common_args = dict(
            teaser='None',
            content='None',
            author=user,
            narrow_image=test_image,
            wide_image=test_image
        )

        publish_date = now() - timedelta(hours=1)

        self.client = Client()

        self.unpublished_comm = Article.objects.create(
            content_type=Article.ArticleTypes.community_profile,
            title='unpublished-comm',
            slug='unpublished-comm',
            **common_args)
        self.unpublished_tips = Article.objects.create(
            content_type=Article.ArticleTypes.tips_and_tricks,
            title='unpublished-tips',
            slug='unpublished-tips',
            **common_args)
        self.published_comm = Article.objects.create(
            content_type=Article.ArticleTypes.community_profile,
            publish_date=publish_date,
            title='published-comm',
            slug='published-comm',
            **common_args)
        self.published_tips = Article.objects.create(
            content_type=Article.ArticleTypes.tips_and_tricks,
            publish_date=publish_date,
            title='published-tips',
            slug='published-tips',
            **common_args)

    def test_home_view(self):
        """Verify that home view includes one article"""

        # Delete second published article so random always returns the same item
        self.published_tips.delete()

        url = reverse('home')
        response = self.client.get(url)
        self.assertContains(response, 'Places we love', status_code=200)
        self.assertContains(response, self.published_comm.title, status_code=200)

    def test_community_profile_manager(self):
        """Test that article manager properly filters community articles"""
        community_profiles_count = Article.profiles.count()
        self.assertEqual(community_profiles_count, 2)

        published_community_profiles_count = Article.profiles.published().count()
        self.assertEqual(published_community_profiles_count, 1)

        random = Article.profiles.random()
        published = Article.profiles.published()[0]
        self.assertEqual(random, published)

    def test_tips_and_tricks_manager(self):
        """Test that article manager properly filters tip articles"""

        tips_count = Article.tips.count()
        self.assertEqual(tips_count, 2)

        published_tips_count = Article.tips.published().count()
        self.assertEqual(published_tips_count, 1)

        random = Article.tips.random()
        published = Article.tips.published()[0]
        self.assertEqual(random, published)

    def test_article_manager(self):
        """Test that article manager filters unpublished articles"""

        published_articles_count = Article.objects.published().count()
        self.assertEqual(published_articles_count, 2)

    def test_learn_detail_view(self):
        """Test that learn detail view works"""
        url = reverse('learn-detail',
                      kwargs={'slug': self.published_comm.slug})
        response = self.client.get(url)
        self.assertContains(response, 'published-comm', status_code=200)

        url = reverse('learn-detail',
                      kwargs={'slug': self.unpublished_comm.slug})
        response_404 = self.client.get(url)
        self.assertEqual(response_404.status_code, 404)

    def test_learn_list_view(self):
        """Test that learn list view works"""
        url = reverse('learn-list')
        response = self.client.get(url)

        self.assertContains(response, self.published_comm.title, status_code=200)
        self.assertContains(response, self.published_tips.title, status_code=200)
